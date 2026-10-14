import 'reflect-metadata';
import { type FastifyRequest } from 'fastify';
import { getAuth, clerkClient } from '@clerk/fastify';

const mockGetUser = jest.fn();
const mockUpdateUserMetadata = jest.fn();
const mockGetAuth = jest.fn();

jest.mock('@clerk/fastify', () => ({
	getAuth: (...args: unknown[]) => mockGetAuth(...args),
	clerkClient: {
		users: {
			getUser: (...args: unknown[]) => mockGetUser(...args),
			updateUserMetadata: (...args: unknown[]) => mockUpdateUserMetadata(...args),
		},
	},
	createClerkClient: jest.fn(() => ({
		users: {
			getUser: (...args: unknown[]) => mockGetUser(...args),
		},
	})),
}));

jest.mock('@/core/logging', () => ({
	Logger: class {
		info = jest.fn();
		error = jest.fn();
		warn = jest.fn();
		debug = jest.fn();
	},
}));

jest.mock('@/core/metrics', () => ({
	trackActiveSession: jest.fn(),
	trackExternal: jest.fn(),
}));

describe('addUserToRequestMiddleware - No Clerk egress for unauthenticated requests', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('does not invoke Clerk SDK user endpoints when request has no authenticated session or token', async () => {
		jest.resetModules();
		const { addUserToRequestMiddleware } =
			await import('../middleware/add-user-to-request.middleware');

		// Simulate Clerk getAuth() returning unauthenticated auth state (as @clerk/fastify does when headers/cookies lack tokens)
		mockGetAuth.mockReturnValue({
			userId: null,
			tokenType: undefined,
			sessionId: null,
			isAuthenticated: false,
		});

		const mockRequest = {
			headers: {},
			cookies: {},
			clientIp: '127.0.0.1',
			user: undefined,
		} as unknown as FastifyRequest;

		await expect(addUserToRequestMiddleware(mockRequest, {} as unknown)).resolves.toBeUndefined();

		expect(mockGetAuth).toHaveBeenCalledTimes(1);
		expect(mockGetAuth).toHaveBeenCalledWith(
			mockRequest,
			expect.objectContaining({
				acceptsToken: ['session_token', 'api_key'],
			}),
		);

		// Assert request.user was not populated with a Clerk user
		expect(mockRequest.user).toBeUndefined();

		// Assert zero outbound Clerk client API calls were made
		expect(mockGetUser).not.toHaveBeenCalled();
		expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
	});
});
