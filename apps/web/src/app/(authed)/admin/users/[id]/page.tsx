'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, KeyRound, Trash2 } from 'lucide-react';
import type { Role, SkillDto, UserSummaryDto } from '@workforce/shared';
import { usersApi } from '@/lib/api/users';
import { skillsApi } from '@/lib/api/skills';
import { friendlyError } from '@/lib/api-errors';
import { useAuthStore } from '@/stores/auth-store';
import { toastError, toastSuccess } from '@/stores/ui-store';
import { SkillsSelect } from '@/components/SkillsSelect';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import styles from './page.module.scss';

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const targetId = params.id;
  const me = useAuthStore((s) => s.user);
  const isSelf = me?.id === targetId;

  const [target, setTarget] = useState<UserSummaryDto | null>(null);
  const [allUsers, setAllUsers] = useState<UserSummaryDto[] | null>(null);
  const [allSkills, setAllSkills] = useState<SkillDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [maxHoursPerWeek, setMaxHoursPerWeek] = useState('40');
  const [skillIds, setSkillIds] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    Promise.all([usersApi.get(targetId), usersApi.list(), skillsApi.list()])
      .then(([u, list, sk]) => {
        setTarget(u);
        setAllUsers(list);
        setAllSkills(sk);
        setFullName(u.fullName);
        setEmail(u.email);
        setRole(u.role);
        setMaxHoursPerWeek(String(u.maxHoursPerWeek));
        setSkillIds(u.skills.map((s) => s.skillId));
      })
      .catch((err: Error) => {
        const message = friendlyError(err, 'Failed to load user');
        setLoadError(message);
        toastError(err, message);
      });
  }, [targetId]);

  const adminCount = allUsers?.filter((u) => u.role === 'ADMIN').length ?? 0;
  const isLastAdmin = !!target && target.role === 'ADMIN' && adminCount <= 1;

  // Self can't change role; last admin can't be demoted; everyone else free.
  const roleDisabled = isSelf || isLastAdmin;
  // Self can't be deleted; last admin can't be deleted.
  const deleteDisabled = isSelf || isLastAdmin;
  const deleteTitle = isSelf
    ? 'You cannot delete yourself'
    : isLastAdmin
      ? 'Cannot delete the last administrator'
      : 'Delete user';

  function validateLocal(): boolean {
    const errs: Record<string, string> = {};
    if (fullName.trim().length < 2) errs.fullName = 'Full name must be at least 2 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email';
    const max = Number.parseInt(maxHoursPerWeek, 10);
    if (!Number.isFinite(max) || max < 1 || max > 80) errs.maxHoursPerWeek = '1–80';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!target) return;
    if (!validateLocal()) return;
    setBusy(true);
    try {
      const body: Parameters<typeof usersApi.update>[1] = {
        fullName: fullName.trim(),
        email,
        maxHoursPerWeek: Number.parseInt(maxHoursPerWeek, 10),
        skillIds,
      };
      // Only send role when allowed to change it AND it changed.
      if (!roleDisabled && role !== target.role) body.role = role;
      await usersApi.update(target.id, body);
      toastSuccess('User updated');
      router.push('/admin/users');
    } catch (err) {
      toastError(err, friendlyError(err, 'Failed to update user'));
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!target) return;
    setPwError(null);
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters');
      return;
    }
    setPwBusy(true);
    try {
      await usersApi.changePassword(target.id, { password: newPassword });
      toastSuccess('Password updated');
      setNewPassword('');
      setPwModalOpen(false);
    } catch (err) {
      const m = friendlyError(err, 'Failed to update password');
      setPwError(m);
      toastError(err, m);
    } finally {
      setPwBusy(false);
    }
  }

  async function deleteUser() {
    if (!target) return;
    setDeleteBusy(true);
    try {
      await usersApi.remove(target.id);
      toastSuccess(`User "${target.fullName}" deleted`);
      router.push('/admin/users');
    } catch (err) {
      toastError(err, friendlyError(err, 'Failed to delete user'));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loadError && !target) {
    return (
      <section>
        <Link href="/admin/users" className={styles.back}>
          <ChevronLeft size={14} /> Back to users
        </Link>
        <p className={styles.error}>{loadError}</p>
      </section>
    );
  }

  if (!target || !allUsers) {
    return (
      <section>
        <Spinner label="Loading user" />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <Link href="/admin/users" className={styles.back}>
        <ChevronLeft size={14} /> Back to users
      </Link>

      <header className={styles.headerRow}>
        <div>
          <h1 className={styles.heading}>
            {target.fullName}
            {isSelf && <span className={styles.youBadge}>(you)</span>}
          </h1>
          <p className={styles.subtitle}>Edit profile, role, hours, skills.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => setPwModalOpen(true)}
          >
            <KeyRound size={14} /> Change password
          </button>
          {!isSelf && (
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={() => setDeleteModalOpen(true)}
              disabled={deleteDisabled}
              title={deleteTitle}
            >
              <Trash2 size={14} /> Delete user
            </button>
          )}
        </div>
      </header>

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
            required
          />
        </Field>

        <Field
          label="Role"
          help={
            isSelf
              ? 'You cannot change your own role.'
              : isLastAdmin
                ? 'Cannot demote the last administrator.'
                : undefined
          }
        >
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={roleDisabled}
          >
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
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <Modal
        open={pwModalOpen}
        title="Change password"
        onClose={() => {
          setPwModalOpen(false);
          setNewPassword('');
          setPwError(null);
        }}
        footer={
          <>
            <button
              type="button"
              className={styles.cancelBtnInline}
              onClick={() => {
                setPwModalOpen(false);
                setNewPassword('');
                setPwError(null);
              }}
              disabled={pwBusy}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="pw-form"
              className={styles.submitBtn}
              disabled={pwBusy}
            >
              {pwBusy ? 'Saving…' : 'Save password'}
            </button>
          </>
        }
      >
        <form id="pw-form" onSubmit={submitPassword}>
          <Field label="New password" error={pwError ?? undefined}>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              maxLength={72}
              autoFocus
              required
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={deleteModalOpen}
        title="Delete user"
        onClose={() => setDeleteModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={styles.cancelBtnInline}
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={deleteUser}
              disabled={deleteBusy}
            >
              {deleteBusy ? 'Deleting…' : 'Delete user'}
            </button>
          </>
        }
      >
        <p>
          Delete <strong>{target.fullName}</strong> ({target.email})?
        </p>
        <p className={styles.muted}>
          All assignments owned by this user will be removed automatically. Projects and tasks
          are not affected.
        </p>
      </Modal>
    </section>
  );
}

function Field({
  label,
  error,
  help,
  children,
}: {
  label: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
      {help && !error && <span className={styles.help}>{help}</span>}
    </label>
  );
}
