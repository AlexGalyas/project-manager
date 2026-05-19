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
import { PageContainer } from '@/components/layout';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  SectionHeader,
  Select,
  Skeleton,
} from '@/components/ui';
import { SkillsSelect } from '@/components/SkillsSelect';
import styles from './page.module.scss';

const ROLE_VARIANT: Record<Role, 'accent' | 'info' | 'neutral'> = {
  ADMIN: 'accent',
  MANAGER: 'info',
  EMPLOYEE: 'neutral',
};

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
  const [maxHoursPerDay, setMaxHoursPerDay] = useState('8');
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
        setMaxHoursPerDay(String(u.maxHoursPerDay));
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

  const roleDisabled = isSelf || isLastAdmin;
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
    const maxDay = Number.parseInt(maxHoursPerDay, 10);
    if (!Number.isFinite(maxDay) || maxDay < 1 || maxDay > 24) errs.maxHoursPerDay = '1–24';
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
        maxHoursPerDay: Number.parseInt(maxHoursPerDay, 10),
        skillIds,
      };
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
      <PageContainer size="narrow">
        <Link href="/admin/users" className={styles.back}>
          <ChevronLeft size={14} /> Back to users
        </Link>
        <p className={styles.error}>{loadError}</p>
      </PageContainer>
    );
  }

  if (!target || !allUsers) {
    return (
      <PageContainer size="narrow">
        <Link href="/admin/users" className={styles.back}>
          <ChevronLeft size={14} /> Back to users
        </Link>
        <Card padding="lg">
          <div className={styles.skeletonBlock}>
            <Skeleton circle width={48} height={48} />
            <div className={styles.skeletonStack}>
              <Skeleton width={220} height={20} />
              <Skeleton width={320} height={14} />
            </div>
          </div>
          <div className={styles.skeletonStack} style={{ marginTop: 'var(--space-4)' }}>
            <Skeleton width="100%" height={36} />
            <Skeleton width="100%" height={36} />
            <Skeleton width="100%" height={36} />
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer size="narrow">
      <Link href="/admin/users" className={styles.back}>
        <ChevronLeft size={14} /> Back to users
      </Link>

      <Card padding="lg">
        <header className={styles.identityRow}>
          <Avatar name={target.fullName} size="lg" />
          <div className={styles.identityText}>
            <h1 className={styles.name}>
              {target.fullName}
              {isSelf && (
                <Badge variant="neutral" size="sm">
                  you
                </Badge>
              )}
            </h1>
            <div className={styles.identityMeta}>
              <span className={styles.email}>{target.email}</span>
              <Badge variant={ROLE_VARIANT[target.role]} size="sm">
                {target.role.toLowerCase()}
              </Badge>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Button
              type="button"
              variant="secondary"
              leftIcon={<KeyRound size={14} />}
              onClick={() => setPwModalOpen(true)}
            >
              Change password
            </Button>
            <Button
              type="button"
              variant="ghost"
              leftIcon={<Trash2 size={14} />}
              onClick={() => setDeleteModalOpen(true)}
              disabled={deleteDisabled}
              title={deleteTitle}
              className={styles.dangerBtn}
            >
              Delete
            </Button>
          </div>
        </header>
      </Card>

      <Card padding="lg">
        <SectionHeader
          as="h2"
          title="Profile"
          description="Edit core profile, role, hours and skills."
        />
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
            required
            error={fieldErrors.email}
          />

          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={roleDisabled}
            helper={
              isSelf
                ? 'You cannot change your own role.'
                : isLastAdmin
                  ? 'Cannot demote the last administrator.'
                  : undefined
            }
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
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Modal
        open={pwModalOpen}
        title="Change password"
        size="sm"
        onClose={() => {
          setPwModalOpen(false);
          setNewPassword('');
          setPwError(null);
        }}
      >
        <Modal.Body>
          <form id="pw-form" onSubmit={submitPassword}>
            <Input
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              maxLength={72}
              autoFocus
              required
              error={pwError ?? undefined}
            />
          </form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setPwModalOpen(false);
              setNewPassword('');
              setPwError(null);
            }}
            disabled={pwBusy}
          >
            Cancel
          </Button>
          <Button type="submit" form="pw-form" loading={pwBusy}>
            Save password
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        open={deleteModalOpen}
        title="Delete user"
        size="sm"
        onClose={() => setDeleteModalOpen(false)}
      >
        <Modal.Body>
          <p>
            Delete <strong>{target.fullName}</strong> ({target.email})?
          </p>
          <p className={styles.muted}>
            All assignments owned by this user will be removed automatically. Projects and tasks
            are not affected.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDeleteModalOpen(false)}
            disabled={deleteBusy}
          >
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={deleteUser} loading={deleteBusy}>
            Delete user
          </Button>
        </Modal.Footer>
      </Modal>
    </PageContainer>
  );
}
