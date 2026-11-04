import { NextResponse } from 'next/server';

function decodeJwtPayload(token: string): Record<string, any> | null {
	try {
		const parts = token.split('.');
		const part = parts[1];
		if (!part) return null;
		const payloadBase64 = part.replace(/-/g, '+').replace(/_/g, '/');
		const json = Buffer.from(payloadBase64, 'base64').toString('utf8');
		return JSON.parse(json);
	} catch {
		return null;
	}
}

// Behind the Coolify/Traefik proxy, request.url resolves to the internal
// host (localhost:3000). Prefer the configured public URL, then forwarded
// headers, then the request origin as last resort.
function getPublicOrigin(request: Request): string {
	const configured = process.env.NEXT_PUBLIC_FRONTEND_URL;
	if (configured) return configured.replace(/\/+$/, '');
	const xfHost = request.headers.get('x-forwarded-host');
	const xfProto = request.headers.get('x-forwarded-proto') ?? 'https';
	if (xfHost) return `${xfProto}://${xfHost}`;
	return new URL(request.url).origin;
}

export async function GET(request: Request) {
	const issuer = process.env.AUTHENTIK_ISSUER;
	const clientId = process.env.AUTHENTIK_CLIENT_ID;
	const clientSecret = process.env.AUTHENTIK_CLIENT_SECRET;

	if (!issuer || !clientId) {
		return new NextResponse(
			'OIDC configuration missing (AUTHENTIK_ISSUER or AUTHENTIK_CLIENT_ID)',
			{
				status: 500,
			},
		);
	}

	const reqUrl = new URL(request.url);
	const code = reqUrl.searchParams.get('code');
	const state = reqUrl.searchParams.get('state');
	const error = reqUrl.searchParams.get('error');
	const errorDescription = reqUrl.searchParams.get('error_description');

	if (error) {
		console.warn(`[oidc-callback] rejected: ${error} - ${errorDescription ?? ''}`);
		return new NextResponse(`OIDC Error: ${error} - ${errorDescription ?? ''}`, { status: 400 });
	}

	if (!code || !state) {
		console.warn('[oidc-callback] rejected: missing code or state');
		return new NextResponse('Missing code or state in callback', { status: 400 });
	}

	// Read stored state and PKCE cookies from request
	const cookieHeader = request.headers.get('cookie') || '';
	const cookies = Object.fromEntries(
		cookieHeader
			.split(';')
			.map((c) => c.trim().split('='))
			.filter(([k]) => Boolean(k))
			.map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
	);

	const storedState = cookies['shortlinks_oidc_state'];
	const storedVerifier = cookies['shortlinks_oidc_pkce'];

	if (!storedState || storedState !== state) {
		console.warn('[oidc-callback] rejected: invalid state');
		return new NextResponse('Invalid state parameter (CSRF detected or expired)', { status: 403 });
	}

	if (!storedVerifier) {
		console.warn('[oidc-callback] rejected: missing code verifier');
		return new NextResponse('Missing PKCE code verifier', { status: 400 });
	}

	// Authentik token endpoint is global, not per-app (see login route).
	const tokenEndpoint = new URL('/application/o/token/', new URL(issuer).origin).toString();
	const redirectUri = new URL('/api/auth/callback', getPublicOrigin(request)).toString();

	const bodyParams = new URLSearchParams({
		grant_type: 'authorization_code',
		client_id: clientId,
		code,
		redirect_uri: redirectUri,
		code_verifier: storedVerifier,
	});

	if (clientSecret) {
		bodyParams.set('client_secret', clientSecret);
	}

	let tokenRes: Response;
	try {
		tokenRes = await fetch(tokenEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: bodyParams.toString(),
		});
	} catch (err: any) {
		return new NextResponse(`Failed to contact token endpoint: ${err.message}`, { status: 502 });
	}

	if (!tokenRes.ok) {
		const errText = await tokenRes.text();
		console.error(`[oidc-callback] token exchange failed: ${tokenRes.status} ${errText}`);
		return new NextResponse(`Token exchange failed: ${errText}`, { status: tokenRes.status });
	}

	const tokenData = await tokenRes.json();
	const accessToken = tokenData.access_token;
	const idToken = tokenData.id_token;

	if (!accessToken) {
		return new NextResponse('No access_token returned by token endpoint', { status: 502 });
	}

	// Parse claims from id_token (fallback to access_token if id_token absent)
	const claims = decodeJwtPayload(idToken || accessToken) || {};
	const sub = claims.sub || 'unknown';
	const email = claims.email || null;
	const name = claims.name || claims.preferred_username || null;
	const exp =
		typeof claims.exp === 'number'
			? claims.exp
			: Math.floor(Date.now() / 1000) + (tokenData.expires_in || 3600);

	// Keep the cookie under the ~4KB browser limit: Authentik JWTs are chunky,
	// so store only the claims we actually consume (me route + provider context).
	// idToken and the full claims object are NOT persisted.
	const sessionPayload = {
		accessToken,
		sub,
		email,
		name,
		exp,
	};

	const sessionCookieValue = Buffer.from(JSON.stringify(sessionPayload)).toString('base64');
	console.log(
		`[oidc-callback] session established: sub=${sub} cookieBytes=${sessionCookieValue.length}`,
	);
	if (sessionCookieValue.length > 4000) {
		console.warn(
			`[oidc-callback] session cookie ${sessionCookieValue.length}B exceeds the ~4KB browser limit and may be dropped`,
		);
	}
	const isSecure = process.env.NODE_ENV === 'production';

	const response = NextResponse.redirect(new URL('/', getPublicOrigin(request)).toString(), 302);

	// Session cookie
	response.cookies.set('shortlinks_oidc_session', sessionCookieValue, {
		httpOnly: true,
		secure: isSecure,
		sameSite: 'lax',
		path: '/',
		maxAge: Math.max(60, exp - Math.floor(Date.now() / 1000)),
	});

	// Clear PKCE and state cookies
	response.cookies.set('shortlinks_oidc_pkce', '', {
		httpOnly: true,
		secure: isSecure,
		sameSite: 'lax',
		path: '/api/auth/callback',
		maxAge: 0,
	});
	response.cookies.set('shortlinks_oidc_state', '', {
		httpOnly: true,
		secure: isSecure,
		sameSite: 'lax',
		path: '/api/auth/callback',
		maxAge: 0,
	});

	return response;
}
