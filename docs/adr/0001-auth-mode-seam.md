# 1. Auth Mode Seam (AUTH_MODE)

Date: 2026-10-14

## Status

Accepted (oidc mode implemented; deployment flip pending Authentik app creation)

## Context

QRcodly was originally designed with hard dependencies on Clerk SaaS authentication across both frontend (`@clerk/nextjs`) and backend (`@clerk/fastify`, `@clerk/backend`). For 10BitWorks self-hosted infrastructure:
1. **Self-hosted requirements**: 10BitWorks operates an on-premise single-sign-on cluster using Authentik (`auth.10bitworks.org`) as the identity provider for local and hosted services.
2. **Third-party SaaS and vendor risk**: External SaaS authentication introduces single points of failure, egress requirements, and operational exposure. The September 2026 sudden deletion of MinIO Docker Hub repositories underscored the fragility of external vendor dependencies for infrastructure operations.
3. **Seamless migration path**: We required an architecture that allows running the application in anonymous/offline mode, testing Authentik OIDC integration, and maintaining zero modifications to upstream application call sites, while supporting instant rollback if needed.

## Decision

We introduce an `AUTH_MODE` configuration seam across backend and frontend with three supported operational modes:
- `clerk`: Legacy Clerk SaaS authentication path (default to guarantee backward compatibility with existing deployments).
- `offline`: Clean no-Clerk anonymous mode. Public endpoints (such as `/u/[shortCode]` redirects and basic QR code generation) work; protected routes return 401 unauthenticated (`request.user = undefined`).
- `oidc`: Authentik OIDC authentication using standard JWT validation via JWKS, mapping user claims to `authentik:<sub>` IDs with automatic Pro plan privileges for 10BitWorks members.

### Technical Implementation

1. **Build-Time Frontend Filesystem Swap (`Dockerfile.frontend`)**:
   Instead of modifying dozens of component and hook imports throughout the frontend application, we implement a build-time seam replacing `@clerk/nextjs` in `node_modules` during container build:
   - If `AUTH_MODE=oidc`: replaces `@clerk/nextjs` package contents with `/app/apps/frontend/src/auth-adapter` (`index.mjs`, `server.mjs`, `package.json`).
   - If `NEXT_PUBLIC_AUTH_DISABLED=true` (and not OIDC): replaces `@clerk/nextjs` with `/app/apps/frontend/src/clerk-shim-package`.
   - Neither: leaves vanilla `@clerk/nextjs` intact.
   This guarantees zero code churn at call sites (`useUser`, `useAuth`, `ClerkProvider`, `SignInButton`, `auth()`, `currentUser()`).

2. **Frontend PKCE & Session Mechanics**:
   - `/api/auth/login`: Generates PKCE code_verifier with SHA-256 challenge (`S256`) and random CSRF state stored in temporary httpOnly cookies scoped to `/api/auth/callback`, redirecting the browser to Authentik's `${AUTHENTIK_ISSUER}/authorize/`.
   - `/api/auth/callback`: Validates state and PKCE verifier, exchanges authorization code for tokens at `${AUTHENTIK_ISSUER}/token/`, and writes the session cookie `shortlinks_oidc_session` (httpOnly, Secure in production, SameSite=Lax, base64-encoded JSON containing `accessToken`, `sub`, `email`, `name`, `claims`, and `exp`).
   - `/api/auth/me`: Validates session cookie expiration and serves claims to client-side auth context.
   - `/api/auth/logout`: Clears session cookie and redirects to `${AUTHENTIK_ISSUER}/end-session/`.
   - Server-side `auth()` in `server.mjs`: Reads `shortlinks_oidc_session` via `next/headers` cookies, verifies `exp` timestamp, and returns user identity `authentik:<sub>`.

3. **Backend Verification & Service Gating**:
   - `Fastify OIDC Plugin` (`oidc.plugin.ts`): Uses `jose` library with `createRemoteJWKSet` targeting `AUTHENTIK_JWKS_URI` (or defaulting to `${AUTHENTIK_ISSUER}/jwks/`). Populates `request.authClaims` on valid Bearer JWT.
   - `User Middleware` (`add-user-to-request.middleware.ts`):
     - `clerk`: Calls Clerk `getAuth()`, verifies ban metadata in Clerk, resolves plan.
     - `oidc`: Sets `request.user = { id: 'authentik:' + claims.sub, tokenType: 'session_token', plan: PlanName.PRO }`.
     - `offline`: Sets `request.user = undefined` without invoking Clerk or external services.
   - `ClerkUserInfoService`: In `oidc` mode, derives email and name directly from the user subject without external network calls.
   - `UserBanService`: In non-clerk modes, bypasses Clerk metadata checks and returns `false` (ban check skipped).
   - `ClerkApiKeysService`: Disabled in non-clerk modes, throwing an explicit error if invoked.
   - `ClerkWebhookController`: Route registration disabled when `AUTH_MODE !== 'clerk'`.

## Consequences

- **Zero Call-Site Churn**: Upstream Next.js components, server actions, and Fastify controllers consume identical auth contracts without vendor-specific branching.
- **Trivial Rollback**: Switching between `oidc`, `offline`, and `clerk` requires only setting environment variables (`AUTH_MODE` and `NEXT_PUBLIC_AUTH_DISABLED`) and triggering a container build/restart.
- **Feature Gating**:
  - API Keys: The API-keys management feature is backed by Clerk and is disabled in non-clerk modes until a local database table and minting logic ship.
  - Ban Enforcement: User ban checks via Clerk metadata are disabled in OIDC mode. Ban state is deferred to a future local database flag.
- **Operational Status**: The current production deployment runs in anonymous mode (`clerk` backend with placeholder keys, frontend `clerk-shim`). The deployment flip to `AUTH_MODE=oidc` is staged and awaits the creation of the Authentik OAuth2/OIDC application and credentials on `auth.10bitworks.org`.
