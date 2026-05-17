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

# 4. Run database migrations (Phase 2+)
pnpm db:migrate

# 5. Seed demo data (Phase 2+)
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

## Phased delivery

This project follows a phased bootstrap. The current state of each phase is summarised here so reviewers can tell what's done.

- **Phase 1 — Skeleton** ✅ monorepo, both apps scaffolded, Docker Compose, AGENTS.md, 4 ADRs.
- **Phase 2 — DB & Auth** ✅ Prisma schema + initial migration, deterministic seed (1 org, 18 users, 10 skills, 8 projects, 60 tasks), `/api/auth/login` and `/api/auth/me`, Passport-JWT strategy, `@CurrentUser` decorator, `RolesGuard`, error envelope filter, `/login` page + Zustand `authStore` with localStorage persistence.
- **Phase 3 — Core CRUD** ✅ `/users`, `/skills`, `/projects` (full CRUD), `/projects/:id/tasks`, `/tasks/:id` (PATCH/DELETE), `/assignments` (list/delete). Global `JwtAuthGuard` with `@Public()` opt-out. Web pages: `/admin`, `/admin/users`, `/manager`, `/manager/projects`, `/manager/projects/[id]` (project + tasks CRUD with skills/deps), `/employee`, `/employee/tasks`, `/employee/projects`. Role-based `/` redirect.
- **Phase 4 — Optimizer** ✅ `OptimizerStrategy` interface + `GreedyOptimizer` (topo sort + composite score + min-load pick + capacity/skill/dep filters), `POST /optimizer/run` (admin/manager), persisted assignments via `upsert`. Web `/manager/optimizer` page with project picker, replace-existing toggle, tunable α/β/γ weights, summary metrics, assignments grouped by employee, unassigned list with reasons.
- **Phase 5 — Workload views** ✅ `GET /workload` (admin/manager) and `GET /workload/me` returning per-employee weekly status (`under` / `normal` / `over`). Manager heatmap `/manager/workload` (employees × Mon–Fri, hours bucketed by task deadline, green/yellow/red cells). Personal `/employee/workload` with utilization bar, my-week heatmap row, and a deadline-sorted task list.
- **Phase 6 — Polish** ☐ empty states, error toasts, FR-01..FR-08 verification, screenshots.

## License

Educational / thesis project — not licensed for redistribution.
