# ADR-0007: Design tokens + in-house primitives over Tailwind/shadcn

- **Status**: Accepted
- **Date**: 2026-05-18

## Context

Through Phase 7.5 the web app was visually serviceable but inconsistent: every page reimplemented its own pill, its own table chrome, its own button hover state, and there was no dark mode. The `_variables.scss` file held the entire visual language, but consumed it inconsistently — some pages used the SCSS variables, others hard-coded hex values, and a few touched both. The cumulative effect was that minor design changes required edits in 15+ files and dark mode would have required rewriting most of them.

Phase 8 needed a coherent answer to four questions:

1. **How are visual values defined?** SCSS variables (current), Tailwind config, CSS custom properties, or a third-party token system?
2. **How are components built?** Hand-rolled per page, a third-party kit (shadcn, Radix, Headless UI, MUI), or a small in-house primitive library?
3. **How is dark mode implemented?** Pixel-perfect duplicate stylesheets, `prefers-color-scheme` media queries, or a `[data-theme]` attribute swap?
4. **How are toasts handled?** The bespoke Zustand-list-plus-custom-component pair from Phase 6 has worked but duplicates well-solved problems (queuing, dismissal, accessibility) — keep it, or adopt a library?

Five alternatives were considered for the bulk of the work (#1 and #2):

- **(A)** Tailwind CSS + shadcn/ui — the modern default.
- **(B)** MUI / Mantine / Chakra — a richer prebuilt kit.
- **(C)** Radix primitives + custom CSS — unstyled headless components plus a hand-rolled visual layer.
- **(D)** SCSS variables only, status-quo, polished page-by-page — keep the existing approach, fix inconsistencies.
- **(E)** **CSS custom-property design tokens + in-house primitives + CSS Modules** — the answer ultimately chosen.

## Decision

- **(E)** Design tokens live as CSS custom properties (`--color-bg`, `--space-3`, `--radius-md`, …) in `apps/web/src/styles/tokens/`. They are the *only* place values appear; everything else references them through `var(--…)`.
- A focused primitive library lives in `apps/web/src/components/ui/` — `Avatar`, `Badge`, `Button`, `Card`, `Checkbox`, `Dropdown`, `EmptyState`, `Field`, `Input`, `Modal`, `SectionHeader`, `Select`, `Skeleton`, `Spinner`, `Switch`, `Tabs`, `Textarea`, `Tooltip`. Each primitive is one folder with `Component.tsx` + `Component.module.scss` + `index.ts`, exported through the barrel `@/components/ui`.
- Layout is `apps/web/src/components/layout/` — `AppShell` (CSS grid), `Header`, `Sidebar` (role-aware, collapsible, persisted), `PageContainer`, `Breadcrumbs`.
- Dark mode is a `data-theme="dark"` attribute on `<html>`. Each token has both a `:root` value and a `[data-theme='dark']` override. The preference is persisted by Zustand in `localStorage.workforce.theme`; an inline `<script>` in `app/layout.tsx` reads it and sets the attribute *before* React hydrates, so there is no flash of the wrong theme.
- Geist (sans + mono) is loaded via `next/font` so it's self-hosted, preloaded, and exposes CSS variables (`--font-geist-sans`, `--font-geist-mono`) the token layer chains into `--font-sans` / `--font-mono`.
- Toasts move to `react-hot-toast`. `apps/web/src/stores/ui-store.ts` keeps the same `toastError(err, fallback)` / `toastSuccess(msg)` helper API so call sites don't churn; the actual queue + render is `react-hot-toast`. The `<Toaster>` is mounted once in `app/layout.tsx` and styled against the design tokens.

## Consequences

**Positive**

- A single source of truth for every visual value. Changing the accent colour edits one line in `_colors.scss`. Switching between light and dark requires no rebuild — the attribute swap is instant.
- The primitive library is small enough to read in an afternoon (~20 components, each <120 LOC). The shape is similar enough to shadcn that someone familiar with that conventions will be productive immediately, without dragging in the library's runtime + Radix.
- CSS Modules give us locally-scoped class names without runtime cost, which keeps the build trivial and the inspector readable. No `clsx`-driven utility soup, no `tw-…` prefixes in the DOM.
- Dark mode is genuinely free — every token has an override, so primitives gain dark mode the moment they reference tokens.
- The toasts swap is a strict upgrade: react-hot-toast handles queueing, swipe-to-dismiss, ARIA, keyboard focus management, and reduced-motion better than the ~30 LOC hand-roll.

**Negative / tradeoffs**

- We own every component. No `npm i` to pick up bug fixes for a primitive — if Tooltip mispositions, we fix it. For an MVP this is fine and educational; for a production app it'd be worth periodically asking whether the library cost has crossed the maintenance cost.
- The token file is the bottleneck on iteration speed. A new semantic colour means editing `_colors.scss` in two places (light + dark) before any consumer can use it. Acceptable but slower than ad-hoc styling.
- Page-by-page migration during Phase 8 meant two systems coexisted briefly: the legacy `_variables.scss` + `components/Modal/Spinner/EmptyState/Nav/ThemeToggle/Toaster` set, and the new tokens + `components/ui/*`. Cleanup removed the legacy duplicates once every page was migrated; some legacy SCSS variables remain for future incremental polish.
- Tailwind's velocity for one-off layouts is real and absent here. We chose token consistency over local speed.

## Rejected alternatives

- **(A) Tailwind + shadcn.** The default move would have shipped fast, but Tailwind's `@apply` and config-driven theme don't pair cleanly with CSS Modules + SCSS, and the project's "no utility CSS frameworks" rule was a deliberate constraint to keep the codebase legible to readers unfamiliar with Tailwind. shadcn's component code lives in your repo (good), but its assumptions (Tailwind, Radix, class-variance-authority) bring the dependency cost back. For a thesis MVP whose readability matters for evaluation, owning fewer abstractions wins.
- **(B) MUI / Mantine / Chakra.** A complete kit was the fastest path to "looks done" but its visual identity would override our own, dark mode would still need a theme provider, and the bundle cost is substantial. The point of Phase 8 was a coherent visual language we control, not an off-the-shelf look.
- **(C) Radix primitives + custom CSS.** Genuinely tempting — Radix's accessibility work is excellent. But for the small surface area of an MVP (one Modal, one Tooltip, one Dropdown) the in-house versions are simpler to read and don't pull in a heavier dep tree. If the project grows past 20 primitives, revisit.
- **(D) Polish the SCSS variables in place.** Doesn't solve the structural problem: SCSS variables compile *into* CSS, so dark mode would need a full stylesheet rebuild per theme. CSS custom properties cascade at runtime and theme via attribute swap — the right tool for this job.

## Code touched

- `apps/web/src/styles/tokens/` — new `_colors.scss`, `_typography.scss`, `_spacing.scss`, `_shadows.scss`, `_radii.scss`, `_transitions.scss`, `_z-index.scss`, `_index.scss` (forward barrel).
- `apps/web/src/styles/globals.scss` — `@use 'tokens'` once, body uses `var(--font-sans)`, smooth theme-swap transition.
- `apps/web/src/app/layout.tsx` — loads Geist via `next/font`, ships the inline `THEME_BOOTSTRAP_SCRIPT` that resolves the persisted theme before hydration, mounts `<Toaster>`.
- `apps/web/src/stores/theme-store.ts` — Zustand `persist` for `'light' | 'dark' | 'system'`; applies the resolved attribute on rehydrate.
- `apps/web/src/stores/sidebar-store.ts` — Zustand `persist` for the sidebar collapsed state.
- `apps/web/src/components/ui/` — Avatar, Badge, Button, Card, Checkbox, Dropdown, EmptyState, Field, Input, Modal, SectionHeader, Select, Skeleton, Spinner, Switch, Tabs, Textarea, Tooltip.
- `apps/web/src/components/layout/` — AppShell, Header, Sidebar, PageContainer, Breadcrumbs.
- `apps/web/src/components/dashboard/StatCard.tsx` — tone-mapped headline metric for dashboards.
- `apps/web/src/components/Toaster.tsx` — wraps `react-hot-toast`'s `<HotToaster>` with token-driven styling.
- `apps/web/src/stores/ui-store.ts` — thin facade over `react-hot-toast` keeping the `toastError` / `toastSuccess` / `toastInfo` API stable.
- Every page under `apps/web/src/app/(authed)/` plus `/login` — refactored to use `PageContainer`, `Card`, primitives, and `StatCard` instead of bespoke per-page SCSS.
- Deleted: `apps/web/src/components/{Nav,Modal,Spinner,EmptyState,ThemeToggle}` and `apps/web/src/app/design-tokens/` (preview surface used during the migration).
