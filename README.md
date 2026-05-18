# Workforce Optimizer

A SaaS-style web app that distributes tasks among employees, balancing workload, skills, priorities, deadlines, and dependencies. **Bachelor thesis MVP** — local-only, single seeded organization, Docker Compose demo.

## Stack

- **Frontend** — Next.js 15 (App Router), React 19, TypeScript, CSS Modules + SCSS, lucide-react, Zustand
- **Backend** — NestJS 11, Prisma 6, PostgreSQL 16, Passport-JWT
- **Shared** — TypeScript types and Zod schemas (`packages/shared`)
- **Tooling** — pnpm workspaces, Docker Compose (Postgres only)

See [AGENTS.md](AGENTS.md) for conventions and [docs/adr/](docs/adr/) for architecture decisions.

## Prerequisites

| Tool | Tested version | Minimum |
| --- | --- | --- |
| Node.js | 22.16.0 | 20.x |
| pnpm | 10.33.2 | 10.x |
| Docker | 29.1.2 | with `docker compose` |

## First-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy example env file
cp .env.example .env

# 3. Start Postgres in Docker
pnpm db:up

# 4. Run database migrations
pnpm db:migrate

# 5. Seed demo data
pnpm db:seed

# 6. Run both apps in dev mode
pnpm dev
```

Then open:

- **Web** — http://localhost:3000
- **API health** — http://localhost:4000/api/health

## Demo credentials

After `pnpm db:seed`:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@demo.local` | `password` |
| Manager | `manager1@demo.local`, `manager2@demo.local` | `password` |
| Employee | `emp1@demo.local` … `emp15@demo.local` | `password` |

## Common commands

```bash
pnpm dev              # web (3000) + api (4000) in parallel
pnpm dev:web          # web only
pnpm dev:api          # api only
pnpm build            # build everything
pnpm typecheck        # typecheck everything
pnpm db:up            # start Postgres in Docker
pnpm db:down          # stop Postgres
pnpm db:migrate       # apply Prisma migrations
pnpm db:seed          # seed demo data
pnpm db:reset         # drop, migrate, and reseed (destructive)
pnpm db:studio        # open Prisma Studio
```

## Repository layout

```
.
├── apps/
│   ├── api/                  NestJS API (port 4000)
│   └── web/                  Next.js web client (port 3000)
├── packages/
│   └── shared/               @workforce/shared — types + Zod schemas
├── docs/adr/                 Architecture Decision Records
├── docker-compose.yml        Postgres 16 container
├── AGENTS.md                 Conventions for contributors
└── README.md                 You are here
```

## Functional requirements

The MVP delivers eight thesis-scoped functional requirements. Each row maps the requirement to the user-facing flow that exercises it end-to-end.

> The wording of FR-01…FR-08 below is the working interpretation derived from
> the project brief; align it with the wording in the thesis specification
> document before defense.

| ID | Requirement | Where it lives | How to verify |
| --- | --- | --- | --- |
| **FR-01** | Role-based authentication: a user signs in with email + password and gets a role-scoped JWT | `POST /api/auth/login`, `GET /api/auth/me`, Passport-JWT strategy, `RolesGuard`, `/login` page, Zustand `authStore` with `localStorage` persistence | Sign in as `admin@demo.local`, `manager1@demo.local`, `emp1@demo.local`; refresh the page → session survives; sign out → token cleared |
| **FR-02** | Project lifecycle: managers/admins create, read, update, delete projects | `GET/POST/GET:id/PATCH:id/DELETE:id /api/projects`, `/manager/projects`, `/manager/projects/[id]`; create/update gated to MANAGER+ADMIN, delete to ADMIN only | As manager: open Projects → New project; open a project → Edit → Save; as admin: Delete |
| **FR-03** | Task lifecycle with skills and dependencies: tasks belong to projects, declare required skills and prerequisite tasks; their priority, hours, deadline, and status are editable | `POST /api/projects/:id/tasks`, `PATCH/DELETE /api/tasks/:id`, multi-select skill + dependency editors on `/manager/projects/[id]` | As manager: add a task with two required skills and a dependency on an earlier task; edit it; change status to IN_PROGRESS; delete it |
| **FR-04** | Skill and team visibility: skills and the team roster (with each user's skills + max hours) are visible to the management roles | `GET /api/skills`, `GET /api/users`, `/admin/users` | As admin or manager: open Users — table shows 18 seeded users with role badges and per-user skill chips |
| **FR-05** | Automated task-to-employee assignment via the greedy optimizer with tunable α/β/γ weights | `POST /api/optimizer/run`, `OptimizerStrategy` interface + `GreedyOptimizer`, `/manager/optimizer` | As manager: open Optimizer → pick projects, toggle Replace existing, tweak weights → Run optimizer; verify metrics strip, assignments grouped by employee, and unassigned reasons |
| **FR-06** | Workload visualization: weekly per-employee summary and a Mon–Fri heatmap with green / yellow / red cells; employees see their own workload | `GET /api/workload`, `GET /api/workload/me`, `/manager/workload`, `/employee/workload` | As manager: open Workload — observe color thresholds; as employee: open My workload — see utilization bar, my-week heatmap row, and deadline-sorted task list |
| **FR-07** | Multi-tenant data isolation: every domain row carries `organizationId` and every API path filters by the caller's organization | Prisma schema (`organizationId` everywhere or via parent), `@CurrentUser()` decorator, every service method scoping by `organizationId`. The MVP seeds one organization but the code paths are exercised by every read/write. | Inspect any service file; assignments scoped per-user for employees; cross-org skill IDs are rejected on task create |
| **FR-08** | Reproducible demo dataset: one seed command produces a deterministic dataset large enough to exercise the optimizer | `apps/api/prisma/seed.ts` (mulberry32 PRNG, fixed seed) — 1 org, 1 admin + 2 managers + 15 employees, 10 skills, 8 projects, 60 tasks (≈ 30 % with intra-project deps) | `pnpm db:reset && pnpm db:seed` from a clean DB twice — counts match, IDs reproduce |

## Screenshots

Placeholders — fill these in by capturing the relevant page after running the demo.

| Page | Path | Image |
| --- | --- | --- |
| Login | `/login` | `docs/screens/login.png` _(placeholder)_ |
| Admin users | `/admin/users` | `docs/screens/admin-users.png` _(placeholder)_ |
| Manager projects | `/manager/projects` | `docs/screens/manager-projects.png` _(placeholder)_ |
| Project detail + tasks | `/manager/projects/[id]` | `docs/screens/manager-project-detail.png` _(placeholder)_ |
| Optimizer | `/manager/optimizer` | `docs/screens/manager-optimizer.png` _(placeholder)_ |
| Team workload heatmap | `/manager/workload` | `docs/screens/manager-workload.png` _(placeholder)_ |
| Employee workload | `/employee/workload` | `docs/screens/employee-workload.png` _(placeholder)_ |

When the files exist, replace the placeholder text with a markdown image, e.g.
`![Manager workload heatmap](docs/screens/manager-workload.png)`.

## Phased delivery

This project follows a phased bootstrap. The current state of each phase is summarised here so reviewers can tell what's done.

- **Phase 1 — Skeleton** ✅ monorepo, both apps scaffolded, Docker Compose, AGENTS.md, 4 ADRs.
- **Phase 2 — DB & Auth** ✅ Prisma schema + initial migration, deterministic seed (1 org, 18 users, 10 skills, 8 projects, 60 tasks), `/api/auth/login` and `/api/auth/me`, Passport-JWT strategy, `@CurrentUser` decorator, `RolesGuard`, error envelope filter, `/login` page + Zustand `authStore` with localStorage persistence.
- **Phase 3 — Core CRUD** ✅ `/users`, `/skills`, `/projects` (full CRUD), `/projects/:id/tasks`, `/tasks/:id` (PATCH/DELETE), `/assignments` (list/delete). Global `JwtAuthGuard` with `@Public()` opt-out. Web pages: `/admin`, `/admin/users`, `/manager`, `/manager/projects`, `/manager/projects/[id]` (project + tasks CRUD with skills/deps), `/employee`, `/employee/tasks`, `/employee/projects`. Role-based `/` redirect.
- **Phase 4 — Optimizer** ✅ `OptimizerStrategy` interface + `GreedyOptimizer` (topo sort + composite score + min-load pick + capacity/skill/dep filters), `POST /optimizer/run` (admin/manager), persisted assignments via `upsert`. Web `/manager/optimizer` page with project picker, replace-existing toggle, tunable α/β/γ weights, summary metrics, assignments grouped by employee, unassigned list with reasons.
- **Phase 5 — Workload views** ✅ `GET /workload` (admin/manager) and `GET /workload/me` returning per-employee weekly status (`under` / `normal` / `over`). Manager heatmap `/manager/workload` (employees × Mon–Fri, hours bucketed by task deadline, green/yellow/red cells). Personal `/employee/workload` with utilization bar, my-week heatmap row, and a deadline-sorted task list.
- **Phase 6 — Polish** ✅ shared `<Spinner />` and toast notification system (`useUIStore` + `<Toaster />`). All page-level loaders show a spinner; all action errors (create / update / delete / optimizer run) surface as error toasts; key success actions show success toasts. Empty states audited across list pages. README extended with the FR-01…FR-08 matrix and screenshot placeholders.
- **Phase 7 — User & Skill Management** ✅ Admin-only CRUD across `users` and `skills`. Endpoints: `GET/POST/PATCH/DELETE /api/users`, `GET /api/users/:id`, `PATCH /api/users/:id/password`, `PUT /api/users/:id/skills`, plus `POST/PATCH/DELETE /api/skills` (`GET /api/skills` now includes per-skill usage counts). Business rules enforced server-side: `CANNOT_EDIT_OWN_ROLE`, `CANNOT_DELETE_SELF`, `LAST_ADMIN`, `EMAIL_TAKEN`, `SKILL_NAME_TAKEN`. Web pages: `/admin/users` (list + delete modal + "(you)" badge + last-admin disabled state), `/admin/users/new` (full create form with show/hide password + skill multi-select), `/admin/users/[id]` (edit + Change-password modal + Delete-user modal, with role/delete disabled when self or last admin), `/admin/skills` (inline create / rename / delete with usage counts). New ADR-0005.
- **Phase 7.5 — Manual Task Assignment & Locking** ✅ Assignments now carry `source` (`MANUAL` / `OPTIMIZER`) and `lockedByManager` (boolean). New endpoints: `POST/PATCH /api/assignments` (with `force: boolean` and a 422 + warnings flow for skill/overload/dependency violations), `POST /api/assignments/:id/lock` and `/unlock`, `GET /api/tasks/:id/assignment`. The optimizer now refuses to modify locked or manual assignments, counts their hours toward employee load, and `replaceExisting: true` only deletes `source = OPTIMIZER AND lockedByManager = false` rows. Web: `/manager/projects/[id]` task table gains an Assignee cell with avatar + name + lock toggle + source badge + inline hours input + unassign × (warning modal + "Assign anyway" path). `/manager/optimizer` swaps the "Replace existing" checkbox for a `Schedule only unassigned` / `Re-optimize everything` radio, plus preserved / locked / removed counters in the result strip. New ADR-0006.

## License

Educational / thesis project — not licensed for redistribution.
