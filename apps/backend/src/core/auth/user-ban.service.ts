import { inject, singleton } from 'tsyringe';
import { clerkClient } from '@clerk/fastify';
import { KeyCache } from '@/core/cache';
import { Logger } from '@/core/logging';
import { trackExternal } from '@/core/metrics';
import { env } from '@/core/config/env';

const USER_BAN_CACHE_TTL = 60;
const banCacheKey = (userId: string) => `user_ban:${userId}`;

export interface BanUserParams {
	reason: string;
	source: string;
	details?: Record<string, unknown>;
}

@singleton()
export class UserBanService {
	constructor(
		@inject(KeyCache) private readonly cache: KeyCache,
		@inject(Logger) private readonly logger: Logger,
	) {}

	/**
	 * Checks if a user is currently banned.
	 * In oidc and offline modes, this is a no-op returning false (not banned).
	 * Note: Ban state for oidc mode will move to a local DB flag when a users table ships (deferred — do NOT build the table).
	 */
	async isUserBanned(userId: string): Promise<boolean> {
		if (env.AUTH_MODE !== 'clerk') {
			this.logger.debug('user_ban.check_skipped_non_clerk_mode', {
				userId,
				authMode: env.AUTH_MODE,
			});
			return false;
		}

		try {
			const cacheKey = banCacheKey(userId);
			const cached = await this.cache.get(cacheKey);
			if (cached !== null) {
				return cached === 1 || cached === '1';
			}

			const user = await trackExternal('clerk', 'users.getUser', () =>
				clerkClient.users.getUser(userId),
			);
			const banned = user.privateMetadata?.banned === true;
			await this.cache.set(cacheKey, banned ? 1 : 0, USER_BAN_CACHE_TTL);
			return banned;
		} catch (error) {
			this.logger.error('user_ban.check_failed', {
				error: error as Error,
				userId,
			});
			return false;
		}
	}

	async ban(userId: string, params: BanUserParams): Promise<void> {
		if (env.AUTH_MODE !== 'clerk') {
			this.logger.debug('user_ban.ban_skipped_non_clerk_mode', {
				userId,
				authMode: env.AUTH_MODE,
				params,
			});
			return;
		}

		const bannedAt = new Date().toISOString();

		await trackExternal('clerk', 'users.updateUserMetadata', () =>
			clerkClient.users.updateUserMetadata(userId, {
				privateMetadata: {
					banned: true,
					bannedAt,
					bannedReason: params.reason,
					bannedBy: params.source,
					banDetails: params.details ?? null,
				},
			}),
		);

		await this.cache.set(banCacheKey(userId), 1, USER_BAN_CACHE_TTL);

		this.logger.info('user.banned', {
			userId,
			reason: params.reason,
			source: params.source,
			bannedAt,
			...params.details,
		});
	}

	async unban(userId: string): Promise<void> {
		if (env.AUTH_MODE !== 'clerk') {
			this.logger.debug('user_ban.unban_skipped_non_clerk_mode', {
				userId,
				authMode: env.AUTH_MODE,
			});
			return;
		}

		await trackExternal('clerk', 'users.updateUserMetadata', () =>
			clerkClient.users.updateUserMetadata(userId, {
				privateMetadata: {
					banned: false,
					bannedReason: null,
					bannedAt: null,
					bannedBy: null,
					banDetails: null,
				},
			}),
		);

		await this.cache.del(banCacheKey(userId));

		this.logger.info('user.unbanned', { userId });
	}
}
