'use client';

// Temporary preview page for the Phase 8 design tokens. Open at /design-tokens
// once `pnpm dev:web` is running. Remove once the redesign lands.

import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemeStore, type ThemePreference } from '@/stores/theme-store';
import { ComponentsSection } from './components-section';
import styles from './page.module.scss';

const NEUTRAL_TOKENS = [
  '--color-bg',
  '--color-bg-subtle',
  '--color-bg-muted',
  '--color-bg-hover',
  '--color-surface',
  '--color-surface-elevated',
  '--color-border',
  '--color-border-strong',
  '--color-text',
  '--color-text-muted',
  '--color-text-subtle',
  '--color-text-inverse',
];

const ACCENT_TOKENS = [
  '--color-accent',
  '--color-accent-hover',
  '--color-accent-active',
  '--color-accent-subtle',
  '--color-accent-text',
];

const SEMANTIC_TOKENS = [
  '--color-success',
  '--color-success-bg',
  '--color-warning',
  '--color-warning-bg',
  '--color-danger',
  '--color-danger-bg',
  '--color-info',
  '--color-info-bg',
];

const LOAD_TOKENS = [
  '--color-load-under',
  '--color-load-normal',
  '--color-load-near',
  '--color-load-over',
];

const TEXT_SIZES = [
  { token: '--text-xs', label: 'xs (12px)' },
  { token: '--text-sm', label: 'sm (13px)' },
  { token: '--text-base', label: 'base (14px)' },
  { token: '--text-md', label: 'md (15px)' },
  { token: '--text-lg', label: 'lg (17px)' },
  { token: '--text-xl', label: 'xl (20px)' },
  { token: '--text-2xl', label: '2xl (24px)' },
  { token: '--text-3xl', label: '3xl (30px)' },
];

const SPACES = [
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-5',
  '--space-6',
  '--space-8',
  '--space-10',
  '--space-12',
  '--space-16',
  '--space-20',
];

const SHADOWS = ['--shadow-xs', '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl'];
const RADII = [
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-xl',
  '--radius-2xl',
  '--radius-full',
];

const FONT_WEIGHTS = [
  { token: '--weight-regular', label: 'regular 400' },
  { token: '--weight-medium', label: 'medium 500' },
  { token: '--weight-semibold', label: 'semibold 600' },
  { token: '--weight-bold', label: 'bold 700' },
];

export default function DesignTokensPage() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Design tokens preview</h1>
          <p className={styles.subtitle}>
            Phase 8 step 2 — review colors / spacing / shadows / radii / typography in light + dark
            before primitives are built. This page is temporary.
          </p>
        </div>
        <ThemePicker preference={preference} onChange={setPreference} />
      </header>

      <Section title="Neutrals" tokens={NEUTRAL_TOKENS} />
      <Section title="Accent (indigo)" tokens={ACCENT_TOKENS} />
      <Section title="Semantic" tokens={SEMANTIC_TOKENS} />
      <Section title="Workload heatmap" tokens={LOAD_TOKENS} />

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Typography</h2>
        <p className={styles.note}>
          Geist font is wired in Step 3. Until then, the preview falls back to system-ui.
        </p>
        <ul className={styles.typoList}>
          {TEXT_SIZES.map(({ token, label }) => (
            <li key={token}>
              <span className={styles.typoLabel}>{label}</span>
              <span className={styles.typoSample} style={{ fontSize: `var(${token})` }}>
                The quick brown fox jumps over the lazy dog.
              </span>
            </li>
          ))}
        </ul>
        <ul className={styles.weightList}>
          {FONT_WEIGHTS.map(({ token, label }) => (
            <li key={token}>
              <span className={styles.typoLabel}>{label}</span>
              <span style={{ fontWeight: `var(${token})` }}>
                The quick brown fox jumps over the lazy dog.
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Spacing</h2>
        <ul className={styles.spaceList}>
          {SPACES.map((token) => (
            <li key={token}>
              <span className={styles.tokenName}>{token}</span>
              <span
                className={styles.spaceBar}
                style={{ width: `var(${token})`, height: 12 }}
              />
              <ResolvedValue token={token} />
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Shadows</h2>
        <ul className={styles.shadowList}>
          {SHADOWS.map((token) => (
            <li key={token} className={styles.shadowItem} style={{ boxShadow: `var(${token})` }}>
              <span className={styles.tokenName}>{token}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Radii</h2>
        <ul className={styles.radiiList}>
          {RADII.map((token) => (
            <li key={token} className={styles.radiiItem} style={{ borderRadius: `var(${token})` }}>
              {token}
            </li>
          ))}
        </ul>
      </section>

      <ComponentsSection />

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Sample composition</h2>
        <p className={styles.note}>
          A small mock card using only tokens — same look in light and dark mode.
        </p>
        <div className={styles.demoCard}>
          <div className={styles.demoCardHeader}>
            <span className={styles.demoBadge}>manual</span>
            <h3>Migrate auth middleware</h3>
            <p className={styles.demoMeta}>Onboarding Revamp · Priority 5 · 14h</p>
          </div>
          <div className={styles.demoCardBody}>
            <p>
              Touches: <span className={styles.demoChip}>React</span>{' '}
              <span className={styles.demoChip}>TypeScript</span>{' '}
              <span className={styles.demoChip}>PostgreSQL</span>
            </p>
            <p className={styles.demoMeta}>Due in 3 days · Employee 5 · 36/40h</p>
          </div>
          <div className={styles.demoCardActions}>
            <button className={styles.demoBtnSecondary}>Cancel</button>
            <button className={styles.demoBtnPrimary}>Save changes</button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Section({ title, tokens }: { title: string; tokens: string[] }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHeading}>{title}</h2>
      <ul className={styles.swatchList}>
        {tokens.map((token) => (
          <li key={token} className={styles.swatchItem}>
            <span
              className={styles.swatch}
              style={{ background: `var(${token})` }}
              aria-hidden
            />
            <span className={styles.swatchMeta}>
              <span className={styles.tokenName}>{token}</span>
              <ResolvedValue token={token} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResolvedValue({ token }: { token: string }) {
  const [value, setValue] = useState<string>('');
  // Resolve on mount + on theme change. Cheap re-read each render is fine for
  // a temporary preview page.
  if (typeof window !== 'undefined') {
    const next = getComputedStyle(document.documentElement)
      .getPropertyValue(token)
      .trim();
    if (next && next !== value) setValue(next);
  }
  return <code className={styles.tokenValue}>{value || '—'}</code>;
}

function ThemePicker({
  preference,
  onChange,
}: {
  preference: ThemePreference;
  onChange: (p: ThemePreference) => void;
}) {
  return (
    <div className={styles.themePicker} role="radiogroup" aria-label="Theme">
      <ThemeBtn current={preference} value="light" onClick={onChange} label="Light">
        <Sun size={14} /> Light
      </ThemeBtn>
      <ThemeBtn current={preference} value="system" onClick={onChange} label="System">
        <Monitor size={14} /> System
      </ThemeBtn>
      <ThemeBtn current={preference} value="dark" onClick={onChange} label="Dark">
        <Moon size={14} /> Dark
      </ThemeBtn>
    </div>
  );
}

function ThemeBtn({
  current,
  value,
  onClick,
  label,
  children,
}: {
  current: ThemePreference;
  value: ThemePreference;
  onClick: (p: ThemePreference) => void;
  label: string;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      className={active ? styles.themeBtnActive : styles.themeBtn}
      onClick={() => onClick(value)}
      role="radio"
      aria-checked={active}
      aria-label={label}
    >
      {children}
    </button>
  );
}
