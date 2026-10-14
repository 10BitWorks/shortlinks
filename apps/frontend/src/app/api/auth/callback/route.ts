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
		return new NextResponse(`OIDC Error: ${error} - ${errorDescription ?? ''}`, { status: 400 });
	}

	if (!code || !state) {
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
		return new NextResponse('Invalid state parameter (CSRF detected or expired)', { status: 403 });
	}

	if (!storedVerifier) {
		return new NextResponse('Missing PKCE code verifier', { status: 400 });
	}

	const cleanIssuer = issuer.endsWith('/') ? issuer : `${issuer}/`;
	const tokenEndpoint = `${cleanIssuer}token/`;
	const redirectUri = new URL('/api/auth/callback', reqUrl.origin).toString();

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

	const sessionPayload = {
		accessToken,
		idToken: idToken || null,
		sub,
		email,
		name,
		claims,
		exp,
	};

	const sessionCookieValue = Buffer.from(JSON.stringify(sessionPayload)).toString('base64');
	const isSecure = process.env.NODE_ENV === 'production';

	const response = NextResponse.redirect(new URL('/', reqUrl.origin).toString(), 302);

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
