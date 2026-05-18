# ADR-0005: User & Skill admin endpoints — shape and protections

- **Status**: Accepted
- **Date**: 2026-05-18

## Context

Phase 7 introduces admin-only CRUD for two related catalogs: users (members of the organization) and skills (the capability tags users own and tasks require). Two design choices had to be made.

### Endpoint shape for replacing a user's skills

The brief permits both options:

1. `PATCH /users/:id` accepts `skillIds` inline alongside `email`, `fullName`, `role`, …
2. A dedicated `PUT /users/:id/skills` that *replaces* the user's full skill set in one call.

Option 1 keeps the API surface tight; option 2 expresses the "replace, not merge" semantics in the URL and lets a future client modify skills without touching profile fields.

### Self-modification and last-admin guards

The brief explicitly lists three protective rules:

- **`CANNOT_EDIT_OWN_ROLE`** — an admin can't demote themselves.
- **`CANNOT_DELETE_SELF`** — an admin can't delete their own account.
- **`LAST_ADMIN`** — the organization must always have at least one administrator. Both `DELETE /users/:id` and `PATCH /users/:id` (when the change would drop the admin count to zero) have to refuse.

These rules can be enforced in the controller, in the service, or via a guard. They are business rules tied to data state ("how many admins remain?"), not authorization rules tied to role membership — so a `RolesGuard`-style check is the wrong shape.

## Decision

### Endpoint shape

Ship **both** patterns:

- `PATCH /users/:id` accepts `skillIds` as an optional partial-update field. The handler does a replace (delete all `UserSkill` rows for the user, recreate with the supplied list) when `skillIds` is present.
- `PUT /users/:id/skills` is a dedicated alias for "replace this user's skills with exactly this list", body `{ skillIds: string[] }`. Useful when the UI has a standalone skill-management surface (the brief's `<SkillsSelect>` lives both inside the user-edit form and could appear in a future per-user side panel).

Both routes use the same underlying service helper so the replace semantics stay consistent and atomic (wrapped in a Prisma `$transaction`).

### Protections

Centralize in `UsersService` as private helpers (`ensureNotLastAdmin`, `ensureSkillsInOrg`) and inline `isSelf` checks at the top of each mutating method. The reasons:

- They depend on a fresh DB read (`prisma.user.count({ where: { role: ADMIN } })`), not on metadata available at the controller layer.
- A `Guard` would have to load the same row twice — once in the guard, once in the service — to know what the caller is asking to change. The service already has the target row.
- Tests/curls can hit the service paths without going through Nest's request lifecycle.

Each violation throws a NestJS `ForbiddenException` whose `response.error` matches a well-known code (`CANNOT_EDIT_OWN_ROLE`, `CANNOT_DELETE_SELF`, `LAST_ADMIN`). The global `HttpExceptionFilter` from Phase 2 picks `error` out of the body and uses it as the envelope's `code`, so the frontend can map it to a friendly message without parsing prose.

Email uniqueness is handled in the same spirit: catch the Prisma `P2002` from a constrained write, rethrow as a `ConflictException` whose `error` is `EMAIL_TAKEN`. Same translation path. Same envelope.

## Consequences

**Positive**

- The frontend `friendlyError()` helper is just a lookup table keyed on `code`. No parsing of message strings, no localization debt.
- New protective rules ("can't reduce a user's `maxHoursPerWeek` below their already-assigned hours", say) drop into the same private-helper pattern.
- The two skill-write paths share `UsersService.setSkillsTx(...)` (the inline `$transaction` callback), so we can't have one staying merge-style while the other is replace-style by accident.

**Negative / tradeoffs**

- Two endpoints for "set this user's skills" means two routes to keep in sync if the input shape grows (e.g. adding `level` to each skill). The shared service helper mitigates that — only the controllers double up.
- The `LAST_ADMIN` path is **rarely reachable in practice**: with only one admin, every call that would trigger it gets caught by `CANNOT_EDIT_OWN_ROLE` / `CANNOT_DELETE_SELF` first. We keep the check anyway because (a) the cost is one extra `count()` per admin-target mutation, and (b) it's the kind of invariant we want enforced in the database tier of the app even if the UI never produces a request that would hit it.
- Inline `isSelf` checks duplicate three lines across `update` and `delete`. Acceptable; abstracting into a decorator would obscure flow.

## Code touched

- `apps/api/src/users/users.service.ts` — added `ensureNotLastAdmin`, `ensureSkillsInOrg`, plus `mapPrismaError(e, email)` that converts `P2002` to `EMAIL_TAKEN`.
- `apps/api/src/users/users.controller.ts` — added `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`, `PATCH /:id/password`, `PUT /:id/skills`.
- `apps/api/src/skills/{skills.service,skills.controller}.ts` — added create/update/delete with `SKILL_NAME_TAKEN` on unique violation; `GET /skills` now returns optional `usage` counts.
- `apps/web/src/lib/api-errors.ts` — friendly-message map keyed on backend `code`.
