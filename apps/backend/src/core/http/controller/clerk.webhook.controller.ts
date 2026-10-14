import { Post } from '@/core/decorators/route';
import AbstractController from './abstract.controller';
import { inject, injectable } from 'tsyringe';
import { clerkWebhookAuthHandler } from '../middleware/clerk-webhook-auth.middleware';
import { type IHttpRequest } from '@/core/interface/request.interface';
import { ClerkWebhookService } from '@/core/services/clerk-webhook.service';
import { env } from '@/core/config/env';

@injectable()
export class ClerkWebhookController extends AbstractController {
	constructor(@inject(ClerkWebhookService) private readonly webhookService: ClerkWebhookService) {
		super();
	}

	@Post('/webhook/clerk', { schema: { hide: true }, authHandler: clerkWebhookAuthHandler })
	async handleWebhook(request: IHttpRequest<unknown, unknown, unknown, false, true>) {
		if (env.AUTH_MODE !== 'clerk') {
			return this.makeApiHttpResponse(404, { message: 'Not found' });
		}
		await this.webhookService.handleWebhookEvent(request.event);
		return this.makeApiHttpResponse(200, { status: 'ok' });
	}
}
