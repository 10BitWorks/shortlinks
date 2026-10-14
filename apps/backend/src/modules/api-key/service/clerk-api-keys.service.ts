import { singleton } from 'tsyringe';
import { createClerkClient } from '@clerk/fastify';
import { env } from '@/core/config/env';

type ClerkClient = ReturnType<typeof createClerkClient>;
type ClerkApiKeysApi = ClerkClient['apiKeys'];

@singleton()
export class ClerkApiKeysService {
	private clerkClient?: ClerkClient;

	constructor() {
		if (env.AUTH_MODE === 'clerk') {
			this.clerkClient = createClerkClient({
				secretKey: env.CLERK_SECRET_KEY,
			});
		}
	}

	/**
	 * API keys are backed by Clerk. In oidc or offline mode, this feature is disabled
	 * until a local API keys table ships (deferred).
	 */
	get apiKeys(): ClerkApiKeysApi {
		if (env.AUTH_MODE !== 'clerk' || !this.clerkClient) {
			throw new Error('API keys are not available in this auth mode');
		}
		return this.clerkClient.apiKeys;
	}
}
