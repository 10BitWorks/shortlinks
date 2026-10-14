import React from 'react';

const signedOut = {
	userId: null,
	sessionId: null,
	actor: null,
	orgId: null,
	orgRole: null,
	orgSlug: null,
	factorVerificationAge: null,
};

function parseSessionCookie() {
	if (typeof document === 'undefined') return null;
	const match = document.cookie.match(/(?:^|;\s*)shortlinks_oidc_session=([^;]*)/);
	if (!match) return null;
	try {
		const json = atob(match[1]);
		return JSON.parse(json);
	} catch {
		return null;
	}
}

// Server-side helper (dashboard layouts call `await auth()`).
export const auth = async () => {
	let session = null;
	try {
		// Dynamically import 'next/headers' to avoid breaking non-RSC contexts
		const { cookies } = await import('next/headers');
		const cookieStore = await cookies();
		const sessionCookie = cookieStore.get('shortlinks_oidc_session');
		if (sessionCookie?.value) {
			const json = Buffer.from(sessionCookie.value, 'base64').toString('utf8');
			session = JSON.parse(json);
			if (session.exp && typeof session.exp === 'number') {
				const now = Math.floor(Date.now() / 1000);
				if (now > session.exp) {
					session = null;
				}
			}
		}
	} catch {
		// Fallback for non-header / client contexts
		session = parseSessionCookie();
	}

	if (session && session.sub) {
		const userId = `authentik:${session.sub}`;
		const sessionId = `oidc_session_${session.sub}`;
		const accessToken = session.accessToken ?? null;
		return {
			userId,
			sessionId,
			actor: null,
			orgId: null,
			orgRole: null,
			orgSlug: null,
			factorVerificationAge: null,
			isLoaded: true,
			isSignedIn: true,
			isAuthenticated: true,
			getToken: async () => accessToken,
			has: () => false,
			protect: async () => {},
			redirectToSignIn: () => {
				const err = new Error('NEXT_REDIRECT;replace;/api/auth/login;307;');
				err.digest = 'NEXT_REDIRECT;replace;/api/auth/login;307;';
				throw err;
			},
		};
	}

	return {
		...signedOut,
		isLoaded: true,
		isSignedIn: false,
		isAuthenticated: false,
		getToken: async () => null,
		has: () => false,
		protect: async () => {},
		redirectToSignIn: () => {
			const err = new Error('NEXT_REDIRECT;replace;/auth-offline;307;');
			err.digest = 'NEXT_REDIRECT;replace;/auth-offline;307;';
			throw err;
		},
	};
};

export const currentUser = async () => {
	const authResult = await auth();
	if (!authResult.isSignedIn) return null;
	return {
		id: authResult.userId,
		emailAddresses: [],
		externalAccounts: [],
		getSessions: async () => [],
	};
};

export const clerkClient = async () => ({
	users: { getUser: async () => null, getUserList: async () => ({ data: [] }) },
});

export const authMiddleware = () => (req) => undefined;

export const getAuth = async (req) => {
	return auth();
};

export const EmailLinkFactorA = 'email_link_factor_a';
export const EmailLinkFactorB = 'email_link_factor_b';
export const withClerkMiddleware = (handler) => handler;

/** @param {(auth: any, req: any, event: any) => any} handler */
export const clerkMiddleware = (handler) => (req, event) => handler({}, req, event);
export const createRouteMatcher = () => () => false;

export const Show = ({ when, children }) => {
	if (when === 'signed-out') {
		return React.createElement(React.Fragment, null, children);
	}
	return null;
};

/** @param {{ children?: any; [key: string]: any }} props */
export const UserAvatar = ({ children }) => null;

/** @param {{ children?: any; [key: string]: any }} props */
export const ClerkProvider = ({ children }) => children;
ClerkProvider.displayName = 'ClerkProviderOidcAdapterServer';

/** @returns {{ isLoaded: boolean; isSignedIn: true; user: { emailAddresses: any[]; externalAccounts: any[]; getSessions: () => Promise<any[]>; [key: string]: any } } | { isLoaded: boolean; isSignedIn: false; user: null }} */
export const useUser = () => ({ isLoaded: true, isSignedIn: false, user: null });
export const useAuth = () => ({
	...signedOut,
	isLoaded: true,
	isSignedIn: false,
	getToken: async () => null,
	has: () => false,
});
export const useSignIn = () => ({ isLoaded: true, signIn: null, setActive: async () => {} });
export const useSignUp = () => ({ isLoaded: true, signUp: null, setActive: async () => {} });
export const useOrganization = () => ({ isLoaded: true, organization: null, membership: null });
export const useOrganizationList = () => ({
	isLoaded: true,
	userMemberships: { data: [] },
	userInvitations: { data: [] },
	userSuggestions: { data: [] },
});
/** @returns {{ isLoaded: boolean; isSignedIn: boolean; session: any }} */
export const useSession = () => ({ isLoaded: true, isSignedIn: false, session: null });
export const useSessionList = () => ({ isLoaded: true, sessions: [] });
export const useClerk = () => ({
	...signedOut,
	openSignIn: (opts) => {},
	openSignUp: (opts) => {},
	openUserProfile: (opts) => {},
	closeSignIn: () => {},
	closeSignUp: () => {},
	closeUserProfile: () => {},
	redirectToSignIn: () => {},
	redirectToSignUp: () => {},
	redirectToAfterAuth: () => {},
	signOut: async () => {},
	setActive: async () => {},
});
export const useProtect = () => () => true;
export const useReverification =
	(fn) =>
	async (...args) =>
		typeof fn === 'function' ? fn(...args) : undefined;

export const SignedIn = ({ children }) => null;
export const SignedOut = ({ children }) => React.createElement(React.Fragment, null, children);
/** @param {{ children?: any; [key: string]: any }} props */
export const UserButton = ({ children }) => null;
/** @param {{ children?: any; [key: string]: any }} props */
export const SignInButton = ({ children }) =>
	React.createElement(React.Fragment, null, children ?? null);
export const SignUpButton = SignInButton;
/** @param {{ children?: any; [key: string]: any }} props */
export const SignOutButton = ({ children }) => null;
/** @param {{ children?: any; [key: string]: any }} props */
export const SignIn = ({ children }) => null;
/** @param {{ children?: any; [key: string]: any }} props */
export const SignUp = ({ children }) => null;
/** @param {{ children?: any; [key: string]: any }} props */
export const UserProfile = ({ children }) => null;
export const Protect = ({ children }) =>
	React.createElement(React.Fragment, null, children ?? null);
/** @param {{ children?: any; [key: string]: any }} props */
export const RedirectToSignIn = ({ children }) => null;
/** @param {{ children?: any; [key: string]: any }} props */
export const RedirectToSignUp = ({ children }) => null;

const ClerkAdapterServer = { Provider: ClerkProvider };
export default ClerkAdapterServer;
