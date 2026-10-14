import fastify, { type FastifyInstance } from 'fastify';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet, type JWK } from 'jose';
import { oidcAuthPlugin } from '../oidc.plugin';

describe('oidcAuthPlugin', () => {
	const issuer = 'https://auth.10bitworks.org/application/o/qrcodly/';
	const audience = 'qrcodly-backend';

	let app: FastifyInstance;
	let publicKeyJWK: JWK;
	let privateKey: any;

	beforeAll(async () => {
		// Generate RSA key pair for local JWKS fixture
		const keyPair = await generateKeyPair('RS256');
		privateKey = keyPair.privateKey;
		const exported = await exportJWK(keyPair.publicKey);
		exported.kid = 'test-key-1';
		exported.alg = 'RS256';
		exported.use = 'sig';
		publicKeyJWK = exported;

		// Create local keySet using jose
		const localKeySet = createLocalJWKSet({
			keys: [publicKeyJWK],
		});

		app = fastify();
		await app.register(oidcAuthPlugin, {
			issuer,
			audience,
			keySet: localKeySet,
		});

		app.get('/test-auth', async (request) => {
			return {
				authClaims: request.authClaims ?? null,
			};
		});

		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('(1) valid token -> claims extracted, correct sub', async () => {
		const token = await new SignJWT({
			sub: 'user_123',
			email: 'user@10bitworks.org',
			name: 'Test User',
			preferred_username: 'testuser',
		})
			.setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
			.setIssuedAt()
			.setIssuer(issuer)
			.setAudience(audience)
			.setExpirationTime('1h')
			.sign(privateKey);

		const response = await app.inject({
			method: 'GET',
			url: '/test-auth',
			headers: {
				authorization: `Bearer ${token}`,
			},
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.authClaims).toBeDefined();
		expect(body.authClaims.sub).toBe('user_123');
		expect(body.authClaims.email).toBe('user@10bitworks.org');
		expect(body.authClaims.name).toBe('Test User');
		expect(body.authClaims.iss).toBe(issuer);
		expect(body.authClaims.aud).toBe(audience);
	});

	it('(2) expired token -> rejected (authClaims undefined)', async () => {
		const token = await new SignJWT({
			sub: 'user_expired',
		})
			.setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
			.setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
			.setIssuer(issuer)
			.setAudience(audience)
			.setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
			.sign(privateKey);

		const response = await app.inject({
			method: 'GET',
			url: '/test-auth',
			headers: {
				authorization: `Bearer ${token}`,
			},
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.authClaims).toBeNull();
	});

	it('(3) wrong audience -> rejected (authClaims undefined)', async () => {
		const token = await new SignJWT({
			sub: 'user_wrong_aud',
		})
			.setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
			.setIssuedAt()
			.setIssuer(issuer)
			.setAudience('wrong-audience')
			.setExpirationTime('1h')
			.sign(privateKey);

		const response = await app.inject({
			method: 'GET',
			url: '/test-auth',
			headers: {
				authorization: `Bearer ${token}`,
			},
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.authClaims).toBeNull();
	});

	it('(4) wrong issuer -> rejected (authClaims undefined)', async () => {
		const token = await new SignJWT({
			sub: 'user_wrong_iss',
		})
			.setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
			.setIssuedAt()
			.setIssuer('https://wrong-issuer.org/')
			.setAudience(audience)
			.setExpirationTime('1h')
			.sign(privateKey);

		const response = await app.inject({
			method: 'GET',
			url: '/test-auth',
			headers: {
				authorization: `Bearer ${token}`,
			},
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.authClaims).toBeNull();
	});

	it('(5) no token -> no claims, no error thrown by the plugin itself', async () => {
		const response = await app.inject({
			method: 'GET',
			url: '/test-auth',
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.authClaims).toBeNull();
	});
});
