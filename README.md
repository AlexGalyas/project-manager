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
- **Phase 2 — DB & Auth** ☐ Prisma schema, first migration, seed, login endpoint.
- **Phase 3 — Core CRUD** ☐ projects/tasks/skills/users endpoints and web pages.
- **Phase 4 — Optimizer** ☐ `OptimizerStrategy` interface + `GreedyOptimizer` + `/manager/optimizer` page.
- **Phase 5 — Workload views** ☐ `/workload`, `/workload/me`, heatmap, employee view.
- **Phase 6 — Polish** ☐ empty states, error toasts, FR-01..FR-08 verification, screenshots.

## License

Educational / thesis project — not licensed for redistribution.
