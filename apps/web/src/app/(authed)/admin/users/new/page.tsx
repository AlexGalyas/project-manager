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
import { PageContainer } from '@/components/layout';
import {
  Button,
  Card,
  Field,
  Input,
  SectionHeader,
  Select,
} from '@/components/ui';
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
  const [maxHoursPerDay, setMaxHoursPerDay] = useState('8');
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
    const maxDay = Number.parseInt(maxHoursPerDay, 10);
    if (!Number.isFinite(maxDay) || maxDay < 1 || maxDay > 24) errs.maxHoursPerDay = '1–24';
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
        maxHoursPerDay: Number.parseInt(maxHoursPerDay, 10),
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
    <PageContainer
      title="Create user"
      description="Add a new admin, manager, or employee. Skills can be added later from the user page."
      size="narrow"
    >
      <Link href="/admin/users" className={styles.back}>
        <ChevronLeft size={14} /> Back to users
      </Link>

      <Card padding="lg">
        <form className={styles.form} onSubmit={submit} noValidate>
          <Input
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={100}
            required
            error={fieldErrors.fullName}
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            error={fieldErrors.email}
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            required
            error={fieldErrors.password}
            helper="At least 8 characters."
            rightSlot={
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            }
          />

          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </Select>

          <Input
            label="Max hours per week"
            type="number"
            min={1}
            max={80}
            value={maxHoursPerWeek}
            onChange={(e) => setMaxHoursPerWeek(e.target.value)}
            error={fieldErrors.maxHoursPerWeek}
            className={styles.numberInput}
          />

          <Input
            label="Max hours per day"
            type="number"
            min={1}
            max={24}
            value={maxHoursPerDay}
            onChange={(e) => setMaxHoursPerDay(e.target.value)}
            error={fieldErrors.maxHoursPerDay}
            helper="Caps a single day so a 14h task spreads across multiple days."
            className={styles.numberInput}
          />

          <Field label="Skills">
            <SkillsSelect allSkills={allSkills} selectedIds={skillIds} onChange={setSkillIds} />
          </Field>

          <div className={styles.actions}>
            <Link href="/admin/users">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button type="submit" loading={busy}>
              Create user
            </Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}
