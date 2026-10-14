'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

const signedOut = {
	userId: null,
	sessionId: null,
	actor: null,
	orgId: null,
	orgRole: null,
	orgSlug: null,
	factorVerificationAge: null,
};

const AuthContext = createContext({
	isLoaded: false,
	isSignedIn: false,
	token: null,
	user: null,
});

/** @param {{ children?: any; [key: string]: any }} props */
export const ClerkProvider = ({ children }) => {
	const [state, setState] = useState({
		isLoaded: false,
		isSignedIn: false,
		token: null,
		user: null,
	});

	useEffect(() => {
		let isMounted = true;
		fetch('/api/auth/me')
			.then(async (res) => {
				if (!res.ok) {
					if (isMounted) setState({ isLoaded: true, isSignedIn: false, token: null, user: null });
					return;
				}
				const data = await res.json();
				if (isMounted) {
					if (data.authenticated && data.accessToken) {
						setState({
							isLoaded: true,
							isSignedIn: true,
							token: data.accessToken,
							user: {
								id: `authentik:${data.sub}`,
								emailAddresses: data.email ? [{ emailAddress: data.email }] : [],
								firstName: data.name ?? null,
								fullName: data.name ?? null,
								externalAccounts: [],
								getSessions: async () => [],
								...data.claims,
							},
						});
					} else {
						setState({ isLoaded: true, isSignedIn: false, token: null, user: null });
					}
				}
			})
			.catch(() => {
				if (isMounted) setState({ isLoaded: true, isSignedIn: false, token: null, user: null });
			});

		return () => {
			isMounted = false;
		};
	}, []);

	return React.createElement(AuthContext.Provider, { value: state }, children);
};
ClerkProvider.displayName = 'ClerkProviderOidcAdapter';

/** @returns {{ isLoaded: boolean; isSignedIn: true; user: { emailAddresses: any[]; externalAccounts: any[]; getSessions: () => Promise<any[]>; [key: string]: any } } | { isLoaded: boolean; isSignedIn: false; user: null }} */
export const useUser = () => {
	const { isLoaded, isSignedIn, user } = useContext(AuthContext);
	if (isSignedIn && user) {
		return { isLoaded: true, isSignedIn: true, user };
	}
	return { isLoaded, isSignedIn: false, user: null };
};

export const useAuth = () => {
	const { isLoaded, isSignedIn, token, user } = useContext(AuthContext);
	return useMemo(
		() => ({
			userId: user ? user.id : null,
			sessionId: user ? `oidc_session_${user.id}` : null,
			actor: null,
			orgId: null,
			orgRole: null,
			orgSlug: null,
			factorVerificationAge: null,
			isLoaded,
			isSignedIn,
			getToken: async () => token,
			has: () => false,
		}),
		[isLoaded, isSignedIn, token, user],
	);
};

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
export const useSession = () => {
	const { isLoaded, isSignedIn, user, token } = useContext(AuthContext);
	const session = isSignedIn
		? {
				id: `oidc_session_${user?.id}`,
				user,
				getToken: async () => token,
			}
		: null;
	return { isLoaded, isSignedIn, session };
};

export const useSessionList = () => {
	const { session } = useSession();
	return { isLoaded: true, sessions: session ? [session] : [] };
};

export const useClerk = () => {
	const { isSignedIn, user } = useContext(AuthContext);
	return {
		userId: user ? user.id : null,
		sessionId: user ? `oidc_session_${user.id}` : null,
		actor: null,
		orgId: null,
		orgRole: null,
		orgSlug: null,
		factorVerificationAge: null,
		openSignIn: () => {
			if (typeof window !== 'undefined') window.location.href = '/api/auth/login';
		},
		openSignUp: () => {
			if (typeof window !== 'undefined') window.location.href = '/api/auth/login';
		},
		openUserProfile: () => {},
		closeSignIn: () => {},
		closeSignUp: () => {},
		closeUserProfile: () => {},
		redirectToSignIn: () => {
			if (typeof window !== 'undefined') window.location.href = '/api/auth/login';
		},
		redirectToSignUp: () => {
			if (typeof window !== 'undefined') window.location.href = '/api/auth/login';
		},
		redirectToAfterAuth: () => {
			if (typeof window !== 'undefined') window.location.href = '/';
		},
		signOut: async () => {
			if (typeof window !== 'undefined') window.location.href = '/api/auth/logout';
		},
		setActive: async () => {},
	};
};

export const useProtect = () => () => true;
export const useReverification =
	(fn) =>
	async (...args) =>
		typeof fn === 'function' ? fn(...args) : undefined;

export const Show = ({ when, children }) => {
	const { isSignedIn, isLoaded } = useContext(AuthContext);
	if (!isLoaded) return null;
	if (when === 'signed-in' && isSignedIn) {
		return React.createElement(React.Fragment, null, children);
	}
	if (when === 'signed-out' && !isSignedIn) {
		return React.createElement(React.Fragment, null, children);
	}
	return null;
};

export const SignedIn = ({ children }) => {
	const { isSignedIn, isLoaded } = useContext(AuthContext);
	if (isLoaded && isSignedIn) {
		return React.createElement(React.Fragment, null, children);
	}
	return null;
};

export const SignedOut = ({ children }) => {
	const { isSignedIn, isLoaded } = useContext(AuthContext);
	if (isLoaded && !isSignedIn) {
		return React.createElement(React.Fragment, null, children);
	}
	return null;
};

/** @param {{ children?: any; [key: string]: any }} props */
export const UserAvatar = ({ children }) => null;

/** @param {{ children?: any; [key: string]: any }} props */
export const UserButton = ({ children }) => null;

/** @param {{ children?: any; [key: string]: any }} props */
export const SignInButton = ({ children }) => {
	const handleClick = (e) => {
		if (typeof window !== 'undefined') {
			window.location.href = '/api/auth/login';
		}
	};
	if (React.isValidElement(children)) {
		return React.cloneElement(children, {
			onClick: (e) => {
				children.props?.onClick?.(e);
				handleClick(e);
			},
		});
	}
	return React.createElement(
		'button',
		{
			type: 'button',
			onClick: handleClick,
		},
		children ?? 'Sign in',
	);
};

export const SignUpButton = SignInButton;

/** @param {{ children?: any; [key: string]: any }} props */
export const SignOutButton = ({ children }) => {
	const handleClick = (e) => {
		if (typeof window !== 'undefined') {
			window.location.href = '/api/auth/logout';
		}
	};
	if (React.isValidElement(children)) {
		return React.cloneElement(children, {
			onClick: (e) => {
				children.props?.onClick?.(e);
				handleClick(e);
			},
		});
	}
	return React.createElement(
		'button',
		{
			type: 'button',
			onClick: handleClick,
		},
		children ?? 'Sign out',
	);
};

/** @param {{ children?: any; [key: string]: any }} props */
export const SignIn = ({ children }) => null;
/** @param {{ children?: any; [key: string]: any }} props */
export const SignUp = ({ children }) => null;
/** @param {{ children?: any; [key: string]: any }} props */
export const UserProfile = ({ children }) => null;
export const Protect = ({ children }) => {
	const { isSignedIn, isLoaded } = useContext(AuthContext);
	if (isLoaded && isSignedIn) {
		return React.createElement(React.Fragment, null, children ?? null);
	}
	return null;
};

/** @param {{ children?: any; [key: string]: any }} props */
export const RedirectToSignIn = ({ children }) => {
	useEffect(() => {
		if (typeof window !== 'undefined') {
			window.location.href = '/api/auth/login';
		}
	}, []);
	return null;
};

/** @param {{ children?: any; [key: string]: any }} props */
export const RedirectToSignUp = ({ children }) => {
	useEffect(() => {
		if (typeof window !== 'undefined') {
			window.location.href = '/api/auth/login';
		}
	}, []);
	return null;
};

// Server-side helper stub for client bundle
export const auth = async () => ({
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
});

export const currentUser = async () => null;
export const clerkClient = async () => ({
	users: { getUser: async () => null, getUserList: async () => ({ data: [] }) },
});
export const authMiddleware = () => (req) => undefined;
export const getAuth = async (req) => ({
	...signedOut,
	isLoaded: true,
	isSignedIn: false,
	getToken: async () => null,
	has: () => false,
});
export const EmailLinkFactorA = 'email_link_factor_a';
export const EmailLinkFactorB = 'email_link_factor_b';
export const withClerkMiddleware = (handler) => handler;
/** @param {(auth: any, req: any, event: any) => any} handler */
export const clerkMiddleware = (handler) => (req, event) => handler({}, req, event);
export const createRouteMatcher = () => () => false;

const ClerkAdapter = { Provider: ClerkProvider };
export default ClerkAdapter;
