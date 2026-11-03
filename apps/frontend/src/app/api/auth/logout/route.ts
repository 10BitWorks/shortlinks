import { NextResponse } from 'next/server';

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

	let redirectTarget = '/';
	if (issuer) {
		const cleanIssuer = issuer.endsWith('/') ? issuer : `${issuer}/`;
		const endSessionUrl = new URL(`${cleanIssuer}end-session/`);
		endSessionUrl.searchParams.set(
			'post_logout_redirect_uri',
			new URL('/', getPublicOrigin(request)).toString(),
		);
		redirectTarget = endSessionUrl.toString();
	}

	const isSecure = process.env.NODE_ENV === 'production';
	const response = NextResponse.redirect(redirectTarget, 302);

	response.cookies.set('shortlinks_oidc_session', '', {
		httpOnly: true,
		secure: isSecure,
		sameSite: 'lax',
		path: '/',
		maxAge: 0,
	});

	return response;
}
