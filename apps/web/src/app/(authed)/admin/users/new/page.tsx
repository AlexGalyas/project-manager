'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';
import type { Role, SkillDto } from '@workforce/shared';
import { usersApi } from '@/lib/api/users';
import { skillsApi } from '@/lib/api/skills';
import { friendlyError } from '@/lib/api-errors';
import { toastError, toastSuccess } from '@/stores/ui-store';
import { SkillsSelect } from '@/components/SkillsSelect';
import styles from './page.module.scss';

export default function NewUserPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [maxHoursPerWeek, setMaxHoursPerWeek] = useState('40');
  const [skillIds, setSkillIds] = useState<string[]>([]);

  const [allSkills, setAllSkills] = useState<SkillDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    skillsApi
      .list()
      .then(setAllSkills)
      .catch((err) => toastError(err, 'Failed to load skills'));
  }, []);

  function validateLocal(): boolean {
    const errs: Record<string, string> = {};
    if (fullName.trim().length < 2) errs.fullName = 'Full name must be at least 2 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email';
    if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    const max = Number.parseInt(maxHoursPerWeek, 10);
    if (!Number.isFinite(max) || max < 1 || max > 80) errs.maxHoursPerWeek = '1–80';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateLocal()) return;
    setBusy(true);
    try {
      await usersApi.create({
        fullName: fullName.trim(),
        email,
        password,
        role,
        maxHoursPerWeek: Number.parseInt(maxHoursPerWeek, 10),
        skillIds,
      });
      toastSuccess(`User "${fullName.trim()}" created`);
      router.push('/admin/users');
    } catch (err) {
      toastError(err, friendlyError(err, 'Failed to create user'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.page}>
      <Link href="/admin/users" className={styles.back}>
        <ChevronLeft size={14} /> Back to users
      </Link>
      <h1 className={styles.heading}>Create user</h1>

      <form className={styles.form} onSubmit={submit} noValidate>
        <Field label="Full name" error={fieldErrors.fullName}>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={100}
            required
          />
        </Field>

        <Field label="Email" error={fieldErrors.email}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>

        <Field label="Password" error={fieldErrors.password}>
          <div className={styles.passwordRow}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className={styles.toggle}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className={styles.help}>At least 8 characters.</p>
        </Field>

        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
        </Field>

        <Field label="Max hours per week" error={fieldErrors.maxHoursPerWeek}>
          <input
            type="number"
            min={1}
            max={80}
            value={maxHoursPerWeek}
            onChange={(e) => setMaxHoursPerWeek(e.target.value)}
          />
        </Field>

        <div>
          <span className={styles.label}>Skills</span>
          <SkillsSelect allSkills={allSkills} selectedIds={skillIds} onChange={setSkillIds} />
        </div>

        <div className={styles.actions}>
          <Link href="/admin/users" className={styles.cancelBtn}>
            Cancel
          </Link>
          <button type="submit" className={styles.submitBtn} disabled={busy}>
            {busy ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </label>
  );
}
