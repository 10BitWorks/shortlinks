import { type FastifyInstance, type FastifyPluginAsync, type FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from 'jose';

export interface AuthentikAuthClaims extends JWTPayload {
	sub: string;
	email?: string;
	name?: string;
	preferred_username?: string;
	groups?: string[];
}

export interface OidcPluginOptions {
	issuer?: string;
	audience?: string;
	jwksUri?: string;
	keySet?: JWTVerifyGetKey;
}

declare module 'fastify' {
	interface FastifyRequest {
		authClaims?: AuthentikAuthClaims;
	}
}

/**
 * Resolves the JWKS URI from options or environment fallback.
 * Authentik exposes JWKS at `${AUTHENTIK_ISSUER}/jwks/` or standard `.well-known/jwks.json`.
 */
export function resolveJwksUri(issuer?: string, explicitJwksUri?: string): string | undefined {
	if (explicitJwksUri) {
		return explicitJwksUri;
	}
	if (!issuer) {
		return undefined;
	}
	const cleanIssuer = issuer.endsWith('/') ? issuer.slice(0, -1) : issuer;
	return `${cleanIssuer}/jwks/`;
}

/**
 * Fastify plugin for Authentik OIDC JWT verification.
 * Decorates requests with verified `authClaims` when a valid Bearer token is present.
 * Unauthenticated requests (no token) pass through without error, leaving `authClaims` undefined.
 */
const pluginFn: FastifyPluginAsync<OidcPluginOptions> = async (
	fastify: FastifyInstance,
	opts: OidcPluginOptions,
) => {
	const issuer = opts.issuer;
	const audience = opts.audience;
	const jwksUri = resolveJwksUri(issuer, opts.jwksUri);

	const keySet: JWTVerifyGetKey | undefined =
		opts.keySet ?? (jwksUri ? createRemoteJWKSet(new URL(jwksUri)) : undefined);

	fastify.decorateRequest('authClaims', undefined);

	fastify.addHook('onRequest', async (request: FastifyRequest) => {
		const authHeader = request.headers.authorization;
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			request.authClaims = undefined;
			return;
		}

		const token = authHeader.substring(7).trim();
		if (!token) {
			request.authClaims = undefined;
			return;
		}

		if (!keySet) {
			request.log.warn(
				'oidcAuthPlugin: keySet not configured (missing issuer or jwksUri). Skipping token verification.',
			);
			request.authClaims = undefined;
			return;
		}

		try {
			const { payload } = await jwtVerify(token, keySet, {
				issuer,
				audience,
			});

			if (typeof payload.sub === 'string' && payload.sub.length > 0) {
				request.authClaims = payload as AuthentikAuthClaims;
			} else {
				request.authClaims = undefined;
			}
		} catch (error) {
			request.log.debug({ err: error }, 'oidcAuthPlugin: JWT verification failed');
			request.authClaims = undefined;
		}
	});
};

export const oidcAuthPlugin = fp(pluginFn, {
	name: 'oidc-auth-plugin',
	fastify: '5.x',
});

export default oidcAuthPlugin;
