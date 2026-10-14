import { NextResponse } from 'next/server';

export async function GET(request: Request) {
	const issuer = process.env.AUTHENTIK_ISSUER;
	const reqUrl = new URL(request.url);

	let redirectTarget = '/';
	if (issuer) {
		const cleanIssuer = issuer.endsWith('/') ? issuer : `${issuer}/`;
		const endSessionUrl = new URL(`${cleanIssuer}end-session/`);
		endSessionUrl.searchParams.set(
			'post_logout_redirect_uri',
			new URL('/', reqUrl.origin).toString(),
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
