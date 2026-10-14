import { NextResponse } from 'next/server';

export async function GET(request: Request) {
	const cookieHeader = request.headers.get('cookie') || '';
	const cookies = Object.fromEntries(
		cookieHeader
			.split(';')
			.map((c) => c.trim().split('='))
			.filter(([k]) => Boolean(k))
			.map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
	);

	const rawSession = cookies['shortlinks_oidc_session'];
	if (!rawSession) {
		return NextResponse.json({ authenticated: false }, { status: 401 });
	}

	try {
		const json = Buffer.from(rawSession, 'base64').toString('utf8');
		const session = JSON.parse(json);

		// Check expiration if exp is present
		if (session.exp && typeof session.exp === 'number') {
			const now = Math.floor(Date.now() / 1000);
			if (now > session.exp) {
				return NextResponse.json(
					{ authenticated: false, error: 'Session expired' },
					{ status: 401 },
				);
			}
		}

		return NextResponse.json({
			authenticated: true,
			accessToken: session.accessToken,
			sub: session.sub,
			email: session.email,
			name: session.name,
			claims: session.claims || {},
		});
	} catch {
		return NextResponse.json({ authenticated: false, error: 'Invalid session' }, { status: 401 });
	}
}
