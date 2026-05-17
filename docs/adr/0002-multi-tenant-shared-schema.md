# ADR-0002: Multi-tenant via shared schema + `organizationId`

- **Status**: Accepted
- **Date**: 2026-05-17

## Context

Although the MVP seeds and demos exactly **one** organization ("Demo Studio"), the thesis describes the system as multi-tenant: the same instance should be able to host independent organizations whose data never mixes. We have to decide *now* how tenants are isolated so that the schema, the API guards, and the seed don't need to be rewritten when a second tenant lands.

Three textbook options:

1. **Database per tenant** — one PostgreSQL database per organization, routed at connection time.
2. **Schema per tenant** — one PostgreSQL schema per organization within a shared database.
3. **Shared schema, tenant column** — every domain table carries an `organizationId` FK; every query filters by it.

## Decision

Adopt **option 3: shared schema with `organizationId` on every domain table**. The JWT payload includes `organizationId`; a `@CurrentUser()` decorator exposes it; every service method scopes its Prisma queries by it; a thin guard at the controller layer asserts that path/body identifiers belong to the caller's organization.

For the MVP:

- Prisma schema defines `organizationId` on `User`, `Skill`, `Project`, and chains it through `Task → Project → organizationId`, `Assignment → User → organizationId`, etc.
- The seed creates one organization and one set of users.
- There is **no** tenant-creation UI; new tenants would be added by ops via the database or a future admin endpoint.

## Consequences

**Positive**

- One database, one schema, one migration history — Prisma stays simple.
- Cross-tenant aggregate analytics (e.g. operator dashboards) become trivial if ever needed.
- Onboarding a new tenant is a single `INSERT` plus seeding their users; no infrastructure changes.
- Operational simplicity matches MVP scope and is defensible in the thesis as "deliberate cost-vs-isolation tradeoff."

**Negative / tradeoffs**

- A bug that omits the `organizationId` filter is a hard tenant-data leak. Mitigation: every repository/service method takes `organizationId` as an explicit parameter sourced from the JWT, not from request inputs; this makes "did I scope the query?" a code-review checklist item.
- Postgres row-level security (RLS) is **not** used in the MVP. Adding it later would be a defense-in-depth upgrade.
- All tenants share resource budgets (connections, indexes, vacuum pressure). Out of scope for a thesis demo.
- A future "noisy" tenant cannot be moved to its own database without a real migration project.
