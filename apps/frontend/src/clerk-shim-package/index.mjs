export const Show = ({ when, children }) => {
	// Auth is disabled: treat every visitor as signed out.
	if (when === 'signed-out') {
		return React.createElement(React.Fragment, null, children);
	}
	return null;
};
export const UserAvatar = () => null;

// Build-time shim for @clerk/nextjs, swapped in via next.config.mjs when
// NEXT_PUBLIC_AUTH_DISABLED=true. Keeps every `useUser`/`useAuth`/`auth()`
// call site working without ClerkProvider or clerk-js, so no browser ever
// contacts the placeholder instance's domain (clerk.accounts.dev).
// Remove this file + the alias when the Authentik OIDC port lands.
'use client';

import React from 'react';

export const ClerkProvider = ({ children }) => children;
ClerkProvider.displayName = 'ClerkProviderShim';

const signedOut = { userId: null, sessionId: null, actor: null, orgId: null, orgRole: null, orgSlug: null, factorVerificationAge: null };

export const useUser = () => ({ isLoaded: true, isSignedIn: false, user: null });
export const useAuth = () => ({ ...signedOut, isLoaded: true, isSignedIn: false, getToken: async () => null, has: () => false });
export const useSignIn = () => ({ isLoaded: true, signIn: null, setActive: async () => {} });
export const useSignUp = () => ({ isLoaded: true, signUp: null, setActive: async () => {} });
export const useOrganization = () => ({ isLoaded: true, organization: null, membership: null });
export const useOrganizationList = () => ({ isLoaded: true, userMemberships: { data: [] }, userInvitations: { data: [] }, userSuggestions: { data: [] } });
export const useSession = () => ({ isLoaded: true, isSignedIn: false, session: null });
export const useSessionList = () => ({ isLoaded: true, sessions: [] });
export const useClerk = () => ({
	...signedOut,
	openSignIn: () => {},
	openSignUp: () => {},
	openUserProfile: () => {},
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
export const useReverification = () => async (fn) => fn();

export const SignedIn = ({ children }) => null;
export const SignedOut = ({ children }) => React.createElement(React.Fragment, null, children);
export const UserButton = () => null;
export const SignInButton = ({ children }) => React.createElement(React.Fragment, null, children ?? null);
export const SignUpButton = SignInButton;
export const SignOutButton = () => null;
export const SignIn = () => null;
export const SignUp = () => null;
export const UserProfile = () => null;
export const Protect = ({ children }) => React.createElement(React.Fragment, null, children ?? null);
export const RedirectToSignIn = () => null;
export const RedirectToSignUp = () => null;

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
