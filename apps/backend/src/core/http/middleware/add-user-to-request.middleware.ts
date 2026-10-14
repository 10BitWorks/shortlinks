import { PlanName } from '@/core/config/plan.config';
import { env } from '@/core/config/env';
import { type TTokenType } from '@/core/domain/schema/UserSchema';
import { Logger } from '@/core/logging';
import { KeyCache } from '@/core/cache';
import { AccountBannedError } from '@/core/error/http';
import { createRequestLogObject } from '@/libs/fastify/helpers';
import { clerkClient, getAuth } from '@clerk/fastify';
import { type FastifyRequest } from 'fastify';
import { container } from 'tsyringe';
import UserSubscriptionRepository from '@/modules/billing/domain/repository/user-subscription.repository';
import { trackActiveSession, trackExternal } from '@/core/metrics';
import { UserBanService } from '@/core/auth/user-ban.service';

const USER_PLAN_CACHE_TTL = 300; // 5 minutes

/**
 * Custom user ban (Clerk's native ban is Pro-only). Ban state lives in the
 * user's Clerk `privateMetadata.banned` flag, set manually in the Clerk
 * dashboard. Cached briefly to avoid a Clerk API call on every request.
 * Fails open on error so a Clerk outage never locks out the whole app.
 */
async function resolveUserBanStatus(userId: string): Promise<boolean> {
	return container.resolve(UserBanService).isUserBanned(userId);
}

async function resolveUserPlan(userId: string): Promise<PlanName> {
	try {
		const cache = container.resolve(KeyCache);
		const cacheKey = `user_plan:${userId}`;

		const cached = await cache.get(cacheKey);
		if (cached !== null) {
			return cached === PlanName.PRO ? PlanName.PRO : PlanName.FREE;
		}

		const repo = container.resolve(UserSubscriptionRepository);
		const subscription = await repo.findByUserId(userId);
		const plan =
			subscription && (subscription.status === 'active' || subscription.status === 'trialing')
				? PlanName.PRO
				: PlanName.FREE;

		await cache.set(cacheKey, plan, USER_PLAN_CACHE_TTL);
		return plan;
	} catch (error) {
		container.resolve(Logger).error('resolveUserPlan.failed', { error: error as Error, userId });
		return PlanName.FREE;
	}
}

export async function addUserToRequestMiddleware(request: FastifyRequest, _reply: unknown) {
	let accessType: TTokenType | undefined;

	if (env.AUTH_MODE === 'clerk') {
		const auth = getAuth(request, {
			acceptsToken: ['session_token', 'api_key'],
		}) as {
			userId: string | null;
			tokenType: TTokenType;
			scopes?: string[];
		};

		const { userId, tokenType } = auth;
		accessType = tokenType;

		if (userId) {
			if (await resolveUserBanStatus(userId)) {
				throw new AccountBannedError(userId);
			}

			const plan = await resolveUserPlan(userId);
			const scopes = tokenType === 'api_key' ? (auth.scopes ?? []) : undefined;
			request.user = { id: userId, tokenType, plan, scopes };
			void trackActiveSession(container.resolve(KeyCache).getClient(), userId);
		} else {
			request.user = undefined;
		}
	} else if (env.AUTH_MODE === 'oidc') {
		const claims = request.authClaims;
		if (claims?.sub) {
			accessType = 'session_token';
			// Single-tenant 10BitWorks instance: all authenticated Authentik users get PRO plan
			request.user = {
				id: `authentik:${claims.sub}`,
				tokenType: 'session_token',
				plan: PlanName.PRO,
				scopes: undefined,
			};
			void trackActiveSession(container.resolve(KeyCache).getClient(), request.user.id);
		} else {
			request.user = undefined;
		}
	} else {
		// AUTH_MODE === 'offline': skip Clerk completely, zero Clerk code paths
		request.user = undefined;
	}

	// don't log health check & uptime kuma
	if (request.clientIp !== '127.0.0.1' && request.clientIp !== '152.53.13.36') {
		container.resolve(Logger).info('api.request', {
			request: createRequestLogObject(request, { accessType }),
		});
	}
}
