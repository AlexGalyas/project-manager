# ADR-0001: Monorepo with pnpm workspaces

- **Status**: Accepted
- **Date**: 2026-05-17

## Context

The Workforce Optimizer MVP ships two deployable artifacts (a Next.js web client and a NestJS API) that share a non-trivial type surface: domain entities, the optimizer's input/output contract, request/response DTOs, and validation schemas. We need a code organization that:

1. Keeps shared types in one place, with both apps importing them at edit-time (not via a published artifact).
2. Lets a single command install all dependencies and run both apps in dev.
3. Supports independent builds and, eventually, independent deployments.
4. Stays simple enough to be reviewable for a bachelor-thesis defense.

The realistic options were: (a) two separate repositories with a publish/install loop for shared types, (b) a single repository with one root `package.json` and two apps mashed together, (c) a monorepo with workspace-aware tooling.

## Decision

Use a **pnpm-workspaces monorepo** with the layout:

```
apps/api          NestJS service
apps/web          Next.js client
packages/shared   TS types + Zod schemas
```

`packages/shared` is referenced as `"@workforce/shared": "workspace:*"`. pnpm hoists shared dependencies, creates symlinks for workspace packages, and supports filtered commands (`pnpm --filter @workforce/api ...`). Root scripts (`pnpm dev`, `pnpm build`, `pnpm typecheck`) fan out via `pnpm -r`.

We chose **pnpm** over npm/yarn workspaces because of (a) disk-efficient content-addressable store (a thesis project will be checked out on multiple machines), (b) strict by default — packages cannot import undeclared deps, which catches accidental coupling, and (c) excellent monorepo ergonomics with `--filter` and `--parallel`.

Turborepo / Nx were considered and rejected: their value is incremental builds and remote caching at scale, neither of which matters for an MVP graded on completeness.

## Consequences

**Positive**

- Single `pnpm install` from the root sets everything up.
- Edits to `@workforce/shared` are picked up immediately by both apps (no publish step).
- Adding a third workspace (e.g. a future `apps/admin` or `packages/optimizer-core`) is mechanical.
- Filter-based scripting (`pnpm --filter @workforce/api db:migrate`) keeps app-specific concerns out of the root.

**Negative / tradeoffs**

- Slight learning curve for contributors unfamiliar with pnpm `workspace:*` semantics.
- A single broken `pnpm install` blocks both apps; the dependency graph is one big graph.
- Eventual deployment must understand how to package only the relevant workspace (e.g. `pnpm deploy` or a build that prunes unused workspace deps). Out of scope for the MVP.
