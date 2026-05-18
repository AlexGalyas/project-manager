'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2, Users as UsersIcon } from 'lucide-react';
import type { Role, UserSummaryDto } from '@workforce/shared';
import { usersApi } from '@/lib/api/users';
import { friendlyError } from '@/lib/api-errors';
import { useAuthStore } from '@/stores/auth-store';
import { toastError, toastSuccess } from '@/stores/ui-store';
import { PageContainer } from '@/components/layout';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  Skeleton,
} from '@/components/ui';
import styles from './page.module.scss';

function isSoleAdmin(user: UserSummaryDto, all: UserSummaryDto[]): boolean {
  if (user.role !== 'ADMIN') return false;
  return all.filter((u) => u.role === 'ADMIN').length <= 1;
}

const ROLE_VARIANT: Record<Role, 'accent' | 'info' | 'neutral'> = {
  ADMIN: 'accent',
  MANAGER: 'info',
  EMPLOYEE: 'neutral',
};

export default function UsersListPage() {
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<UserSummaryDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserSummaryDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function refresh() {
    try {
      setLoadError(null);
      setUsers(await usersApi.list());
    } catch (err) {
      const message = friendlyError(err, 'Failed to load users');
      setLoadError(message);
      toastError(err, message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const adminCount = useMemo(
    () => users?.filter((u) => u.role === 'ADMIN').length ?? 0,
    [users],
  );

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleteBusy(true);
    try {
      await usersApi.remove(confirmDelete.id);
      toastSuccess(`User "${confirmDelete.fullName}" deleted`);
      setConfirmDelete(null);
      await refresh();
    } catch (err) {
      toastError(err, friendlyError(err, 'Failed to delete user'));
    } finally {
      setDeleteBusy(false);
    }
  }

  const description = users
    ? `${users.length} user${users.length === 1 ? '' : 's'} · ${adminCount} admin${adminCount === 1 ? '' : 's'}`
    : loadError
      ? 'Could not load users'
      : 'Loading…';

  return (
    <PageContainer
      title="Users"
      description={description}
      actions={
        <Link href="/admin/users/new" className={styles.cta}>
          <Button leftIcon={<Plus size={14} />}>Create user</Button>
        </Link>
      }
    >
      {loadError && <p className={styles.error}>{loadError}</p>}

      <Card padding="none">
        {!users && !loadError && (
          <div className={styles.skeletonStack}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={styles.skeletonRow}>
                <Skeleton circle width={28} height={28} />
                <Skeleton width={180} height={14} />
                <Skeleton width={140} height={14} />
                <Skeleton width={60} height={14} />
                <Skeleton width={120} height={14} />
              </div>
            ))}
          </div>
        )}

        {users && users.length === 0 && (
          <EmptyState
            icon={<UsersIcon size={20} />}
            title="No users"
            description="Seed the database or click Create user to add one."
            action={
              <Link href="/admin/users/new">
                <Button leftIcon={<Plus size={14} />}>Create user</Button>
              </Link>
            }
          />
        )}

        {users && users.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Max h/wk</th>
                  <th>Skills</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = me?.id === u.id;
                  const lastAdmin = isSoleAdmin(u, users);
                  const cannotDelete = isSelf || lastAdmin;
                  const deleteTitle = isSelf
                    ? 'You cannot delete yourself'
                    : lastAdmin
                      ? 'Cannot delete the last administrator'
                      : `Delete ${u.fullName}`;
                  return (
                    <tr key={u.id}>
                      <td>
                        <span className={styles.identity}>
                          <Avatar name={u.fullName} size="sm" />
                          <span className={styles.identityText}>
                            <span className={styles.name}>
                              {u.fullName}
                              {isSelf && <span className={styles.youBadge}>(you)</span>}
                            </span>
                            <span className={styles.email}>{u.email}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <Badge variant={ROLE_VARIANT[u.role]} size="sm">
                          {u.role.toLowerCase()}
                        </Badge>
                      </td>
                      <td className={styles.hours}>{u.maxHoursPerWeek}h</td>
                      <td>
                        {u.skills.length === 0 ? (
                          <span className={styles.muted}>—</span>
                        ) : (
                          <ul className={styles.skillChips}>
                            {u.skills.map((s) => (
                              <li key={s.skillId}>
                                <Badge variant="neutral" size="sm">
                                  {s.name}
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <Link href={`/admin/users/${u.id}`} aria-label={`Edit ${u.fullName}`}>
                            <Button variant="ghost" size="sm" aria-label={`Edit ${u.fullName}`}>
                              <Pencil size={14} />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDelete(u)}
                            disabled={cannotDelete}
                            title={deleteTitle}
                            aria-label={deleteTitle}
                            className={styles.dangerBtn}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete user"
        size="sm"
      >
        <Modal.Body>
          {confirmDelete && (
            <>
              <p>
                Delete <strong>{confirmDelete.fullName}</strong> ({confirmDelete.email})?
              </p>
              <p className={styles.muted}>
                All assignments owned by this user will be removed automatically. Projects and
                tasks are not affected.
              </p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={deleteBusy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleteBusy}>
            Delete user
          </Button>
        </Modal.Footer>
      </Modal>
    </PageContainer>
  );
}
