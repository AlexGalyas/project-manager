# AGENTS.md — Workforce Optimizer

Conventions and operating notes for anyone (human or AI agent) contributing to this repository.

## 1. Project overview

Workforce Optimizer is a SaaS-style web app that distributes tasks among employees while balancing workload, skills, priorities, deadlines, and dependencies. It is the MVP for a bachelor thesis. The MVP runs locally only, with a single seeded organization, and is demoed via Docker Compose plus `pnpm dev`.

## 2. Stack

- **Node.js**: 22.x (project tested on v22.16.0; minimum 20)
- **pnpm**: 10.x (project tested on 10.33.2)
- **PostgreSQL**: 16 (run via Docker Compose)
- **TypeScript**: 5.6.x everywhere
- **Frontend** (`apps/web`): Next.js 15 (App Router) + React 19 + CSS Modules with SCSS variables + lucide-react + Zustand
- **Backend** (`apps/api`): NestJS 11 + Prisma 6 + Passport-JWT
- **Shared** (`packages/shared`): TypeScript types and Zod schemas consumed by both apps

## 3. Commands

Run all commands from the repo root unless otherwise noted.

```bash
pnpm install           # install all workspace deps
pnpm db:up             # start Postgres in Docker (detached)
pnpm db:down           # stop Postgres
pnpm db:migrate        # run Prisma migrations (dev)
pnpm db:seed           # seed demo data
pnpm db:reset          # drop, migrate, and reseed (destructive)
pnpm db:studio         # open Prisma Studio
pnpm dev               # run apps/web (3000) and apps/api (4000) in parallel
pnpm dev:web           # web only
pnpm dev:api           # api only
pnpm build             # build everything
pnpm typecheck         # typecheck everything
```

Demo credentials (after `pnpm db:seed`):

- Admin: `admin@demo.local` / `password`
- Managers: `manager1@demo.local`, `manager2@demo.local` / `password`
- Employees: `emp1@demo.local` … `emp15@demo.local` / `password`

## 4. Architecture

### Monorepo layout

```
.
├── apps/
│   ├── api/                  NestJS API
│   └── web/                  Next.js web client
├── packages/
│   └── shared/               TS types + Zod schemas shared by api & web
├── docs/
│   └── adr/                  Architecture Decision Records
├── docker-compose.yml        Postgres only
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── AGENTS.md
└── README.md
```

### Shared types

`@workforce/shared` re-exports TypeScript types (`Role`, `TaskStatus`, ...) and Zod schemas. Both `apps/api` and `apps/web` import from it via the `@shared/*` alias and the workspace dependency `"@workforce/shared": "workspace:*"`.

### JWT auth flow

1. `POST /api/auth/login` accepts `{ email, password }`, returns `{ token, user }`.
2. JWT payload includes `userId`, `organizationId`, `role`. Signed with `JWT_SECRET`. Expires in 7 days.
3. The web app stores the token in `localStorage` (see Caveat below).
4. Subsequent requests carry `Authorization: Bearer <token>`. NestJS validates via Passport-JWT.
5. A `@CurrentUser()` parameter decorator exposes `{ userId, organizationId, role }` to controllers; a `RolesGuard` enforces role-based access.

### Multi-tenant approach

Every domain table carries `organizationId` (directly or via parent). The MVP seeds **one** organization and links all data to it, but all API queries scope by the caller's `organizationId` so the schema is ready for a future tenant-creation flow.

## 5. Conventions

- **Naming**
  - Files: `kebab-case.ts` (e.g. `optimizer-strategy.interface.ts`)
  - React components: `PascalCase.tsx` (e.g. `WorkloadHeatmap.tsx`)
  - Variables/functions: `camelCase`
  - Types/interfaces: `PascalCase`
- **Imports**
  - `@/` → app-internal (resolves to `apps/<app>/src`)
  - `@shared/` → `packages/shared/src`
  - Workspace deps use `"@workforce/<pkg>": "workspace:*"`
- **API responses**
  - Success: JSON body of the requested resource
  - Error: `{ "error": { "code": string, "message": string } }` with appropriate HTTP status
- **Validation**: Zod schemas live in `packages/shared/src/schemas.ts` and are consumed by NestJS pipes on the API side and form code on the web side.
- **Styling** (web): CSS Modules with SCSS. Global SCSS variables in `apps/web/src/styles/_variables.scss`. No inline styles. No utility CSS frameworks.
- **Do not introduce new libraries** without updating this file and (if architecturally significant) adding an ADR.

## 6. Caveats

- **JWT in `localStorage`** is acceptable for this MVP demo, NOT for production. XSS leaks the token. Mitigations would be: httpOnly cookies + CSRF protection, or a session-cookie + refresh-token rotation. See `docs/adr/0004-jwt-in-localstorage.md`.
- **One seeded organization** — the multi-tenant code paths exist but are not exercised. No registration UI.
- **No automated tests** in the MVP. Jest scaffolding may exist but is not part of any CI requirement.
- **Greedy optimizer** — produces a feasible assignment, not a globally optimal one. A future strategy (LP, GA, …) can plug in via `OptimizerStrategy`.

## 7. ADR pointers

- [0001 — Monorepo with pnpm workspaces](docs/adr/0001-monorepo-pnpm-workspaces.md)
- [0002 — Multi-tenant via shared schema + organizationId](docs/adr/0002-multi-tenant-shared-schema.md)
- [0003 — Greedy algorithm with strategy pattern](docs/adr/0003-greedy-strategy-pattern.md)
- [0004 — JWT in localStorage for MVP](docs/adr/0004-jwt-in-localstorage.md)
