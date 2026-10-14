export const Show = ({ when, children }) => {
	// Auth is disabled: treat every visitor as signed out.
	if (when === 'signed-out') {
		return React.createElement(React.Fragment, null, children);
	}
	return null;
};
/** @param {{ children?: any; [key: string]: any }} props */
export const UserAvatar = ({ children }) => null;

// Build-time shim for @clerk/nextjs, swapped in via next.config.mjs when
// NEXT_PUBLIC_AUTH_DISABLED=true. Keeps every `useUser`/`useAuth`/`auth()`
// call site working without ClerkProvider or clerk-js, so no browser ever
// contacts the placeholder instance's domain (clerk.accounts.dev).
// Remove this file + the alias when the Authentik OIDC port lands.

import React from 'react';

/** @param {{ children?: any; [key: string]: any }} props */
export const ClerkProvider = ({ children }) => children;
ClerkProvider.displayName = 'ClerkProviderShim';

const signedOut = { userId: null, sessionId: null, actor: null, orgId: null, orgRole: null, orgSlug: null, factorVerificationAge: null };

/** @returns {{ isLoaded: boolean; isSignedIn: true; user: { emailAddresses: any[]; externalAccounts: any[]; getSessions: () => Promise<any[]>; [key: string]: any } } | { isLoaded: boolean; isSignedIn: false; user: null }} */
export const useUser = () => ({ isLoaded: true, isSignedIn: false, user: null });
export const useAuth = () => ({ ...signedOut, isLoaded: true, isSignedIn: false, getToken: async () => null, has: () => false });
export const useSignIn = () => ({ isLoaded: true, signIn: null, setActive: async () => {} });
export const useSignUp = () => ({ isLoaded: true, signUp: null, setActive: async () => {} });
export const useOrganization = () => ({ isLoaded: true, organization: null, membership: null });
export const useOrganizationList = () => ({ isLoaded: true, userMemberships: { data: [] }, userInvitations: { data: [] }, userSuggestions: { data: [] } });
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
export const useReverification = (fn) => async (...args) => (typeof fn === 'function' ? fn(...args) : undefined);

export const SignedIn = ({ children }) => null;
export const SignedOut = ({ children }) => React.createElement(React.Fragment, null, children);
/** @param {{ children?: any; [key: string]: any }} props */
export const UserButton = ({ children }) => null;
/** @param {{ children?: any; [key: string]: any }} props */
export const SignInButton = ({ children }) => React.createElement(React.Fragment, null, children ?? null);
export const SignUpButton = SignInButton;
/** @param {{ children?: any; [key: string]: any }} props */
export const SignOutButton = ({ children }) => null;
/** @param {{ children?: any; [key: string]: any }} props */
export const SignIn = ({ children }) => null;
/** @param {{ children?: any; [key: string]: any }} props */
export const SignUp = ({ children }) => null;
/** @param {{ children?: any; [key: string]: any }} props */
export const UserProfile = ({ children }) => null;
export const Protect = ({ children }) => React.createElement(React.Fragment, null, children ?? null);
/** @param {{ children?: any; [key: string]: any }} props */
export const RedirectToSignIn = ({ children }) => null;
/** @param {{ children?: any; [key: string]: any }} props */
export const RedirectToSignUp = ({ children }) => null;

// Server-side helper (dashboard layouts call `await auth()`).
export const auth = async () => ({
	...signedOut,
	isLoaded: true,
	isSignedIn: false,
	isAuthenticated: false,
	getToken: async () => null,
	has: () => false,
	protect: async () => {},
	redirectToSignIn: () => {
		// Match Clerk's behavior: throws NEXT_REDIRECT so layouts bounce
		// signed-out users. Sends them to the homepage while auth is offline.
		const err = new Error('NEXT_REDIRECT;replacement:/;status:307;');
		err.digest = 'NEXT_REDIRECT;replacement:/;status:307;';
		throw err;
	},
});

export const currentUser = async () => null;
export const clerkClient = async () => ({ users: { getUser: async () => null, getUserList: async () => ({ data: [] }) } });
export const authMiddleware = () => (req) => undefined;
export const getAuth = async (req) => ({ ...signedOut, isLoaded: true, isSignedIn: false, getToken: async () => null, has: () => false });
export const EmailLinkFactorA = 'email_link_factor_a';
export const EmailLinkFactorB = 'email_link_factor_b';
export const withClerkMiddleware = (handler) => handler;
export const clerkMiddleware = (handler) => (req, event) => handler({}, req, event);
export const createRouteMatcher = () => () => false;

const ClerkShim = { Provider: ClerkProvider };
export default ClerkShim;
