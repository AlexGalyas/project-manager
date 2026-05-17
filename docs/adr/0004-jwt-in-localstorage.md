# ADR-0004: JWT in `localStorage` for the MVP

- **Status**: Accepted (with known security caveat)
- **Date**: 2026-05-17

## Context

The MVP needs an auth mechanism for the demo (one admin, two managers, fifteen employees). The brief calls for a stateless JWT (`Authorization: Bearer …`), no refresh-token flow, no registration UI, and a 7-day expiry.

Where the browser persists the token across reloads is the part that has real security consequences:

1. **`localStorage`** — readable by any JavaScript on the page (XSS vulnerability surface).
2. **`sessionStorage`** — same XSS exposure, plus lost on every tab close (UX hurt).
3. **`httpOnly` cookie** — not readable by JS at all, but requires server-side cookie-set logic and CSRF protection on every mutating endpoint.
4. **In-memory only** — survives no reload at all; demo would force re-login constantly.

## Decision

For the MVP, store the JWT in `localStorage` and attach it to outgoing API calls via a thin `apiClient.ts` wrapper. The Zustand `authStore` is the in-memory cache; `localStorage` is the persistence layer. On app boot the store rehydrates from `localStorage`; on logout, both are cleared.

This is documented as a **known, accepted MVP tradeoff** in `AGENTS.md` (Caveats) and in this ADR so reviewers (including the thesis committee) see the decision was conscious, not accidental.

## Consequences

**Positive**

- Zero server-side cookie machinery. No CORS-with-credentials, no CSRF tokens, no `SameSite` debates.
- The web client is a pure SPA-ish App Router app; no need for Next.js server actions or middleware just to manage cookies.
- Demos cleanly: open the app, log in, refresh, still logged in.

**Negative / tradeoffs**

- Any XSS on the web app exfiltrates the token. The MVP does not render user-controlled HTML and uses React's default escaping, so the surface area is small — but the risk is real for any production system.
- A leaked token is valid for 7 days; there is no revocation list. Mitigation in production would be: short-lived access tokens + rotated refresh tokens, plus a revocation table.
- If the MVP ever leaves the demo box, **switching to `httpOnly` cookies should be the first hardening step**. The contract change is small (server sets/clears a cookie instead of returning a token in the body), but every API call site that currently injects the `Authorization` header has to be revisited.
