import { inject, singleton } from 'tsyringe';
import { createClerkClient } from '@clerk/fastify';
import { env } from '../config/env';
import { Logger } from '../logging';

export type TClerkUserInfo = { email: string; firstName?: string };

/**
 * Looks up the contact details needed to send a user an email.
 *
 * Fails soft: a Clerk outage must not stop a subscription transition from being recorded, so a
 * failed lookup yields an empty address and the caller simply sends no mail.
 */
@singleton()
export class ClerkUserInfoService {
	private clerkClient?: ReturnType<typeof createClerkClient>;

	constructor(@inject(Logger) private readonly logger: Logger) {
		if (env.AUTH_MODE === 'clerk') {
			this.clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
		}
	}

	async getUserInfo(userId: string): Promise<TClerkUserInfo> {
		if (env.AUTH_MODE === 'offline') {
			return {
				email: 'admin@10bitworks.local',
				firstName: 'Local',
			};
		}

		if (env.AUTH_MODE === 'oidc') {
			// In oidc mode, user IDs have the format 'authentik:<sub>' or '<sub>'.
			// Derive user info without network egress.
			const sub = userId.startsWith('authentik:') ? userId.slice('authentik:'.length) : userId;
			return {
				email: sub.includes('@') ? sub : `${sub}@10bitworks.local`,
				firstName: sub.split('@')[0] || 'User',
			};
		}

		if (!this.clerkClient) {
			this.clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
		}

		try {
			const user = await this.clerkClient.users.getUser(userId);
			return {
				email: user.emailAddresses[0]?.emailAddress ?? '',
				firstName: user.firstName ?? undefined,
			};
		} catch (error) {
			this.logger.error('clerk.getUserInfo.failed', {
				user: { id: userId },
				error: error as Error,
			});
			return { email: '' };
		}
	}
}
