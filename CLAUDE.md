# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QRcodly is a full-stack QR code generator and management platform. It's a pnpm monorepo.

## Monorepo Structure

```
apps/
├── backend/           # Fastify REST API (Node.js)
├── frontend/          # Next.js 16 web application (React 19)
└── browser-extension/ # Vite-based browser extension

packages/
├── shared/            # @shared/schemas - DTOs, Zod v4 schemas, utilities
├── eslint-config/
└── typescript-config/
```

## Commands

### Development

```bash
# Start local services (MySQL, Redis, MinIO, etc.)
cd apps/backend && pnpm run dev-server   # or: docker-compose up -d

# Run both apps
pnpm run start:dev

# Run individually
pnpm run backend:dev     # Fastify API at :5001 (runs migrations first)
pnpm run frontend:dev    # Next.js at :3000 (uses Turbopack)
```

### Building

```bash
pnpm run build                 # Build all apps
pnpm run build:shared-package  # Build shared package only (must run before app builds)
pnpm run backend:build         # Build backend (builds shared first)
pnpm run frontend:build        # Build frontend (builds shared first)
```

### Testing

```bash
# Backend tests (Jest)
cd apps/backend
pnpm run test                    # Run all tests (runs migrations first, uses --runInBand)
pnpm run test -- path/to/test    # Run specific test file
pnpm run test:coverage           # Run with coverage

# Pre-PR validation
pnpm run pr:precheck             # lint + typecheck + test + build
```

### Linting & Type Checking

```bash
pnpm run lint            # Lint all workspaces
pnpm run format          # Prettier format entire repo

# Per-app
cd apps/backend && pnpm run lint && pnpm run typecheck
cd apps/frontend && pnpm run check  # runs lint + typecheck
```

### Database

```bash
cd apps/backend
pnpm run db:migrate              # Apply migrations (runs automatically with dev/test)
pnpm run db:generate-migration   # Generate new migration from schema changes
pnpm run studio                  # Open Drizzle Studio
```

## Authentication (AUTH_MODE)

Three-way auth seam across frontend and backend. Enables seamless transition from SaaS Clerk to self-hosted Authentik OIDC or offline anonymous mode with zero call-site modifications.

### Operational Modes
- `clerk` (default): Legacy Clerk SaaS path (`@clerk/fastify` + `@clerk/nextjs`). Uses dummy/placeholder keys in current deployment.
- `offline`: Clean no-Clerk anonymous mode. Public endpoints work (`/u/[shortCode]` redirects, basic QR generation). Protected endpoints return 401 (`request.user = undefined`).
- `oidc`: Authentik OIDC via `jose` remote JWKS. Maps user ID to `authentik:<sub>` with automatic `PlanName.PRO` access (single-tenant 10BitWorks instance).

### Environment Variables
- `AUTH_MODE`: `clerk` | `offline` | `oidc` (default: `clerk`).
- `AUTHENTIK_ISSUER`: OIDC provider URL (e.g. `https://auth.10bitworks.org/application/o/shortlinks/`).
- `AUTHENTIK_CLIENT_ID`: OAuth2 Client ID (frontend + backend).
- `AUTHENTIK_CLIENT_SECRET`: OAuth2 Client Secret (frontend token exchange only).
- `AUTHENTIK_JWKS_URI`: Optional explicit JWKS endpoint; fallback defaults to `${AUTHENTIK_ISSUER}/jwks/`.

### Frontend Build-Time File Swap (`Dockerfile.frontend`)
Build-time seam replacing `@clerk/nextjs` in `node_modules` before Next.js build:
- `AUTH_MODE=oidc`: Swaps `apps/frontend/src/auth-adapter/` into `@clerk/nextjs`.
- `NEXT_PUBLIC_AUTH_DISABLED=true` (and not OIDC): Swaps `apps/frontend/src/clerk-shim-package/` into `@clerk/nextjs`.
- Neither: Retains vanilla `@clerk/nextjs`.

### OIDC PKCE Routes & Adapter
- `/api/auth/login`: Generates PKCE verifier (S256 challenge) and random CSRF state in temporary httpOnly cookies (`/api/auth/callback` path), redirects to `${issuer}/authorize/`. `SignInButton` / `SignUpButton` navigate here.
- `/api/auth/callback`: Validates state and verifier, exchanges code at `${issuer}/token/`, sets session cookie `shortlinks_oidc_session` (httpOnly, base64 JSON, `exp`-checked), redirects to `/`.
- `/api/auth/me`: Reads session cookie, validates expiration, returns user claims to client `ClerkProvider` context.
- `/api/auth/logout`: Clears `shortlinks_oidc_session` and redirects to `${issuer}/end-session/`.
- Server helper `server.mjs`: `await auth()` reads `shortlinks_oidc_session`, validates `exp`, returns `userId: "authentik:<sub>"`. Unauthenticated calls bounce to `/auth-offline` via NEXT_REDIRECT digest.

### Rollback & Deployment Status
- Rollback to `offline`: Single env flip (`AUTH_MODE=offline`, `NEXT_PUBLIC_AUTH_DISABLED=true`).
- **Current Status / TODO**: The deployment currently runs in anonymous mode (frontend shim, backend clerk-with-placeholder-keys); the deployment flip to `AUTH_MODE=oidc` awaits Authentik application and secret creation.

## Architecture

### Backend (`apps/backend`)

**Tech Stack**: Fastify, Drizzle ORM (MySQL), Redis, Clerk auth, S3/MinIO, Pino logging, tsyringe DI

**Module Structure** (`src/modules/`): 7 modules — `qr-code`, `url-shortener`, `billing`, `custom-domain`, `config-template`, `tag`, `analytics-integration`

Each module follows this layout:

- `domain/entities/` — Drizzle table definitions + TypeScript types
- `domain/repository/` — Data access extending `AbstractRepository`
- `useCase/` — Business logic classes (`*.use-case.ts`)
- `http/controller/` — Decorator-based route handlers
- `http/__tests__/` — Integration tests
- `service/` — Stateless services (optional)
- `event/handler/` — Event handlers (optional)
- `setup.ts` — Module registration via `registerRoutes()`

**DI Conventions (tsyringe)**:

- Controllers and UseCases: `@injectable()` (transient, new instance per resolution)
- Repositories and Services: `@singleton()` (single shared instance)
- All deps injected via `@inject(ClassName)` constructor params

**Route Registration**: Decorator-based (`@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`) with Zod schema validation for body/query/response. Routes are registered in each module's `setup.ts` via `registerRoutes(fastify, ControllerClass, prefix)`.

**API prefix**: `/api/v1` (e.g., `/api/v1/qr-code`, `/api/v1/short-url`, `/api/v1/billing`)

**Core infrastructure** (`src/core/`):

- `db/` — Connection, schema re-exports, migrations. All entity schemas centrally re-exported from `db/schemas/index.ts`
- `cache/` — Redis caching (`KeyCache`)
- `storage/` — S3/MinIO file uploads
- `server.ts` — Fastify server setup, plugin registration, module loading

**Database patterns**: `AbstractRepository` provides pagination, caching, soft deletes. `UnitOfWork` + `TransactionContext` for multi-operation transactions.

### Frontend (`apps/frontend`)

**Tech Stack**: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS, shadcn/ui, Zustand, TanStack Query, Clerk, next-intl

**Routing**: `src/app/[locale]/` — locale-prefixed routes. Dashboard routes under `/dashboard/` are protected via Clerk middleware.

**Middleware**: `src/proxy.ts` chains Clerk auth + next-intl middleware. Handles `/u/[shortCode]` analytics redirects.

**API calls** (`src/lib/api/`): `apiRequest<T>()` utility with Bearer token auth from Clerk. Each API module exports TanStack Query hooks (e.g., `useListQrCodesQuery`, `useCreateQrCodeMutation`).

**State**: Zustand store (`src/store/useQrCodeStore.ts`) for QR code generator form state with localStorage persistence.

**Env validation**: `@t3-oss/env-nextjs` in `src/env.js` — type-safe server/client env vars.

**i18n**: 9 locales (en, de, es, fr, it, nl, pl, pt, ru). Translation files in `src/dictionaries/`. Uses `localePrefix: 'as-needed'`.

### Shared Package (`packages/shared`)

Published as `@shared/schemas`. Import via: `import { ... } from '@shared/schemas'`

Uses **Zod v4** (from pnpm catalog). Contains:

- `src/schemas/` — Source-of-truth Zod schemas (e.g., `QrCode.ts` with discriminated union for 8 content types: URL, Text, WiFi, vCard, Email, Location, Event, EPC)
- `src/dtos/` — Request/response DTOs derived from schemas via `.pick()`, `.extend()`. Organized by feature domain.
- `src/utils/` — QR code content converters, default styling options, deep diff utility

**DTO naming**: `CreateXDto`, `UpdateXDto`, `XResponseDto`, `XPaginatedResponseDto`, `XListRequestDto`

Build: `tsc` → `dist/` (CommonJS). Must be built before backend/frontend (`pnpm run build:shared-package`).

## Local Development Environment

Docker Compose provides:

- MySQL (3306) — root/root, database: qrcodly
- Redis (6379)
- Garage S3 (3900) — credentials via `GARAGE_*` env vars, bucket auto-bootstrapped
- phpMyAdmin (8081)
- Umami analytics (3001)

## Testing Patterns

Backend tests use Jest with:

- Global setup/teardown for test database isolation
- `--runInBand` for sequential execution
- 30 second timeout per test
- Tests in `__tests__/` directories within module `http/` dirs

## Key Conventions

- **Database naming**: snake_case for tables and columns
- **TypeScript**: Strict mode, path aliases (`@/*` for local, `@shared/schemas` or `@shared/schemas/*` for shared)
- **Formatting**: Prettier with tabs, semicolons, 100 char width
- **Git hooks**: lefthook runs Prettier on staged files at pre-commit
- **Locale translations**: When adding/changing user-facing strings, update all 9 locale dictionaries

## Git Conventions

### Commit messages — Conventional Commits

Format: `<type>(<optional scope>): <short imperative subject>`

- **Types**: `feat`, `fix`, `chore`, `refactor`, `style`, `docs`, `test`, `perf`, `build`, `ci`
- **Scope** (optional, lowercase): area of the codebase — e.g. `ui`, `db`, `backend`, `frontend`, `billing`, `qr-code`, `mcp-server`, `build`
- **Subject**: imperative mood ("add", not "added"), lowercase first letter, no trailing period, ≤ 72 chars
- **Body** (optional, blank line after subject, wrap ~72 chars): explain the _why_, not the _what_ — the diff already shows what changed
- **Breaking changes**: add `!` after type/scope (`feat(api)!: drop v1 endpoints`) or a `BREAKING CHANGE: <desc>` footer

Good examples:

- `feat(billing): add Stripe checkout session endpoint`
- `fix(ui): prevent Select dropdown clipping inside modal`
- `chore(deps): bump drizzle-orm to 0.36`
- `refactor(db): extract Drizzle tables to @qrcodly/db package`
- `test(qr-code): cover vCard note field serialization`

Avoid: vague subjects (`updated stuff`), past tense, capitalized subjects, trailing periods, missing type.

### Branch names

Format: `<type>/<short-kebab-description>`

- Types: same set as commits, plus `hotfix/` for urgent prod fixes
- Description: kebab-case, ≤ ~50 chars, descriptive but compact
- Optional ticket suffix: `feat/stripe-checkout-#412`

Good examples: `fix/select-zindex-in-modals`, `feat/mcp-server`, `refactor/db-package-extract`

Avoid: no-type branches (`my-changes`), username-only branches (`flo-fix`), dates without context.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `FloB95/qrcodly`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
