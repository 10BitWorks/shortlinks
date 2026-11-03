import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

function base64UrlEncode(buffer: Buffer): string {
	return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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

	if (!issuer || !clientId) {
		return new NextResponse(
			'OIDC configuration missing (AUTHENTIK_ISSUER or AUTHENTIK_CLIENT_ID)',
			{
				status: 500,
			},
		);
	}

	// Authentik exposes authorize/token GLOBALLY at `${origin}/application/o/*`,
	// NOT per-app under the issuer. Issuer = https://auth.10bitworks.org/application/o/shortlinks/
	const authOrigin = new URL(issuer).origin;
	const authorizeUrl = new URL('/application/o/authorize/', authOrigin);

	const redirectUri = new URL('/api/auth/callback', getPublicOrigin(request)).toString();

	// Generate PKCE code_verifier and code_challenge (S256)
	const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
	const hash = crypto.createHash('sha256').update(codeVerifier).digest();
	const codeChallenge = base64UrlEncode(hash);

	// Generate random state for CSRF protection
	const state = base64UrlEncode(crypto.randomBytes(24));

	authorizeUrl.searchParams.set('client_id', clientId);
	authorizeUrl.searchParams.set('redirect_uri', redirectUri);
	authorizeUrl.searchParams.set('response_type', 'code');
	authorizeUrl.searchParams.set('scope', 'openid profile email');
	authorizeUrl.searchParams.set('state', state);
	authorizeUrl.searchParams.set('code_challenge', codeChallenge);
	authorizeUrl.searchParams.set('code_challenge_method', 'S256');

	const isSecure = process.env.NODE_ENV === 'production';
	const response = NextResponse.redirect(authorizeUrl.toString(), 302);

	response.cookies.set('shortlinks_oidc_pkce', codeVerifier, {
		httpOnly: true,
		secure: isSecure,
		sameSite: 'lax',
		path: '/api/auth/callback',
		maxAge: 600, // 10 minutes
	});

	response.cookies.set('shortlinks_oidc_state', state, {
		httpOnly: true,
		secure: isSecure,
		sameSite: 'lax',
		path: '/api/auth/callback',
		maxAge: 600, // 10 minutes
	});

	return response;
}
