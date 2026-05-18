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
- **Styling** (web): CSS Modules with SCSS. Design tokens are CSS custom properties defined in `apps/web/src/styles/tokens/` (colors, typography, spacing, shadows, radii, transitions, z-index). Dark mode is a `[data-theme='dark']` swap on `<html>`. SCSS files reference tokens via `var(--…)`; legacy `_variables.scss` exists only for unstyled corners and is being phased out. No inline styles. No utility CSS frameworks. No component libraries — see ADR-0007.
- **Do not introduce new libraries** without updating this file and (if architecturally significant) adding an ADR.

## 6. Features (post-MVP additions)

### Phase 7 — Users & Skills CRUD (Admin)

Admin-only management of the organization's members and skill catalog. Routes:

- `GET/POST/PATCH/DELETE /api/users`, `GET /api/users/:id`, `PATCH /api/users/:id/password`, `PUT /api/users/:id/skills`.
- `GET/POST/PATCH/DELETE /api/skills` (admin-only for the mutating routes; the existing `GET /api/skills` stays open to MANAGER/EMPLOYEE for the multi-select pickers).

Web pages: `/admin/users` (list + delete modal), `/admin/users/new` (create form with all fields + skill multi-select + show/hide password), `/admin/users/[id]` (edit + Change-password modal + Delete-user modal), `/admin/skills` (inline create / rename / delete with per-skill usage counts).

### Business rules to remember

These three rules are enforced in `UsersService` and **must** stay there. The web mirrors them by disabling/hiding controls, but the API is the source of truth.

- **`CANNOT_EDIT_OWN_ROLE`** — `PATCH /users/:id` rejects 403 if `req.user.id === params.id` and the body changes `role`.
- **`CANNOT_DELETE_SELF`** — `DELETE /users/:id` rejects 403 if `req.user.id === params.id`.
- **`LAST_ADMIN`** — both `DELETE /users/:id` (when the target is ADMIN) and `PATCH /users/:id` (when an ADMIN is being demoted by someone else) call `ensureNotLastAdmin(organizationId)`. The count must be `> 1` for the action to proceed.
- **`EMAIL_TAKEN`** — Prisma's `P2002` on the `User.email` unique index is caught and rethrown as `ConflictException` with `error: 'EMAIL_TAKEN'` so the frontend's `friendlyError()` map can show a useful message.
- **`SKILL_NAME_TAKEN`** — same pattern for `Skill.(organizationId, name)` unique constraint.

Cascade deletes are configured in `prisma/schema.prisma`:

- Deleting a `User` removes their `UserSkill` rows and all their `Assignment` rows.
- Deleting a `Skill` removes the related `UserSkill` and `TaskSkill` rows.

When extending: add new business rules as private helpers in the service, not inline `if` chains; throw `ForbiddenException`/`ConflictException` with a stable `error` code, and add the friendly message to `apps/web/src/lib/api-errors.ts`.

See [ADR-0005](docs/adr/0005-user-skill-admin-routes.md) for the design of the user/skill admin endpoints, including the dual `PATCH /users/:id` + `PUT /users/:id/skills` shape.

### Assignment Lifecycle (Phase 7.5)

Every `Assignment` row carries two extra columns introduced in Phase 7.5:

- **`source`** — `MANUAL` (a manager set it via the assignee dropdown / `POST /assignments` / `PATCH /assignments/:id`) or `OPTIMIZER` (created by `POST /optimizer/run`). The default for new manual rows is `MANUAL`; the optimizer always writes `OPTIMIZER`.
- **`lockedByManager`** — boolean. When `true`, the optimizer **must not** modify or delete this row on any subsequent run. New manual rows default to `true`. Optimizer-created rows default to `false`.

### Optimizer's contract with these flags

- The initial per-employee load passed into the strategy is the sum of `plannedHours` across **all** surviving assignments (manual + locked + any optimizer rows that aren't being cleaned up). The strategy therefore never proposes work that would push a user past their cap, *including* hours the manager has locked in.
- `replaceExisting: true` deletes only rows where `source = OPTIMIZER AND lockedByManager = false` within the scope. Manual and locked rows are sacred.
- After cleanup the optimizer skips any task that already has a surviving assignment.
- New assignments produced by the optimizer are persisted via plain `create` with `source: OPTIMIZER, lockedByManager: false`. They can be locked later by the manager via `POST /assignments/:id/lock`.

### Force + warnings (422 envelope)

`POST /assignments` and `PATCH /assignments/:id` run three validators (`checkSkills`, `checkOverload`, `checkDependencies`). When any warning fires AND `force: false` (the default), the response is **422** with:

```json
{ "error": {
    "code": "ASSIGNMENT_WARNINGS",
    "message": "Assignment has unresolved issues; resend with force=true to proceed.",
    "details": { "warnings": [ { "code": "MISSING_SKILLS", "message": "...", "details": ... } ] }
} }
```

The frontend reads `details.warnings`, displays them in `<AssignmentWarningsModal>`, and on "Assign anyway" replays the same payload with `force: true`. Forced calls succeed and return the same `warnings` array in the success body so the manager can audit what they overrode.

Adding a new warning type: add it to `AssignmentWarningCode` in `packages/shared`, write a `check…` helper in `apps/api/src/assignments/validators`, call it inside `AssignmentsService.collectWarnings`, add an icon entry to `AssignmentWarningsModal`. No other plumbing required — the 422 envelope is generic.

See [ADR-0006](docs/adr/0006-assignment-source-and-locking.md) for the model rationale.

### Phase 8 — Design system

The web app uses a hand-rolled design system: design tokens plus a primitive library, no Tailwind and no third-party component kit. Rationale and trade-offs are in [ADR-0007](docs/adr/0007-design-tokens-and-primitives.md).

**Tokens** — `apps/web/src/styles/tokens/`:

- `_colors.scss` — neutrals + indigo accent + semantic (success/warning/danger/info) + workload heatmap. Light values in `:root`, dark overrides in `[data-theme='dark']`.
- `_typography.scss` — `--font-sans` / `--font-mono` chain Geist (loaded via `next/font` in `apps/web/src/app/layout.tsx`), text scale (xs..3xl), weights, leading.
- `_spacing.scss`, `_shadows.scss`, `_radii.scss`, `_transitions.scss`, `_z-index.scss`.
- `_index.scss` — `@forward` barrel; consumed once in `apps/web/src/styles/globals.scss`.

**Primitives** — `apps/web/src/components/ui/` (one folder per primitive, each with `Component.tsx` + `Component.module.scss` + `index.ts`):

`Avatar`, `Badge`, `Button`, `Card` (+ `CardHeader/Body/Footer`), `Checkbox`, `Dropdown`, `EmptyState`, `Field`, `Input`, `Modal` (+ `Modal.Header/Body/Footer`), `SectionHeader`, `Select`, `Skeleton`, `Spinner`, `Switch`, `Tabs`, `Textarea`, `Tooltip`. All re-exported from `@/components/ui`.

**Layout** — `apps/web/src/components/layout/`:

- `AppShell` — CSS-grid wrapper (Header full-width on top, Sidebar left, Main right) used by `(authed)/layout.tsx`.
- `Header` — sticky bar with brand + user `Dropdown` (theme switch lives in its `menuFooter`).
- `Sidebar` — role-aware navigation driven by `nav-config.ts`; collapsed state persisted via `sidebar-store`.
- `PageContainer` — padded main element with optional title/description/actions/breadcrumbs and `size: 'default' | 'narrow' | 'wide'`.

**Theme** — `apps/web/src/stores/theme-store.ts` persists `'light' | 'dark' | 'system'` in `localStorage.workforce.theme`. An inline `<script>` in `app/layout.tsx` resolves the preference before React hydrates so there is no flash.

**Dashboard helper** — `apps/web/src/components/dashboard/StatCard.tsx` (tone-mapped headline metrics with skeleton when `value === null`).

**Toasts** — `react-hot-toast`. `apps/web/src/stores/ui-store.ts` exposes `toastError(err, fallback)` / `toastSuccess(msg)` / `toastInfo(msg)`; the `<Toaster>` is mounted once in `app/layout.tsx` and styled against design tokens.

When adding a new piece of UI: reach for the primitives first, only fall back to bespoke SCSS if no combination works. Use `var(--…)` tokens — never hex values, never SCSS color variables.

## 7. Caveats

- **JWT in `localStorage`** is acceptable for this MVP demo, NOT for production. XSS leaks the token. Mitigations would be: httpOnly cookies + CSRF protection, or a session-cookie + refresh-token rotation. See `docs/adr/0004-jwt-in-localstorage.md`.
- **One seeded organization** — the multi-tenant code paths exist but are not exercised. No registration UI.
- **No automated tests** in the MVP. Jest scaffolding may exist but is not part of any CI requirement.
- **Greedy optimizer** — produces a feasible assignment, not a globally optimal one. A future strategy (LP, GA, …) can plug in via `OptimizerStrategy`.

## 8. ADR pointers

- [0001 — Monorepo with pnpm workspaces](docs/adr/0001-monorepo-pnpm-workspaces.md)
- [0002 — Multi-tenant via shared schema + organizationId](docs/adr/0002-multi-tenant-shared-schema.md)
- [0003 — Greedy algorithm with strategy pattern](docs/adr/0003-greedy-strategy-pattern.md)
- [0004 — JWT in localStorage for MVP](docs/adr/0004-jwt-in-localstorage.md)
- [0005 — User & Skill admin endpoints — shape and protections](docs/adr/0005-user-skill-admin-routes.md)
- [0006 — Assignment source and manager-locking model](docs/adr/0006-assignment-source-and-locking.md)
- [0007 — Design tokens + in-house primitives over Tailwind/shadcn](docs/adr/0007-design-tokens-and-primitives.md)
