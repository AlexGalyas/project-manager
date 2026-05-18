'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Role, UserSummaryDto } from '@workforce/shared';
import { usersApi } from '@/lib/api/users';
import { friendlyError } from '@/lib/api-errors';
import { useAuthStore } from '@/stores/auth-store';
import { toastError, toastSuccess } from '@/stores/ui-store';
import { EmptyState } from '@/components/EmptyState';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import styles from './page.module.scss';

function isSoleAdmin(user: UserSummaryDto, all: UserSummaryDto[]): boolean {
  if (user.role !== 'ADMIN') return false;
  return all.filter((u) => u.role === 'ADMIN').length <= 1;
}

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
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

  return (
    <section>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Users</h1>
          <p className={styles.subtitle}>
            {users
              ? `${users.length} user${users.length === 1 ? '' : 's'} · ${adminCount} admin${adminCount === 1 ? '' : 's'}`
              : loadError
                ? 'Could not load users'
                : 'Loading…'}
          </p>
        </div>
        <Link href="/admin/users/new" className={styles.newBtn}>
          <Plus size={16} /> Create user
        </Link>
      </div>

      {loadError && <p className={styles.error}>{loadError}</p>}

      {!users && !loadError && <Spinner />}

      {users && users.length === 0 && (
        <EmptyState
          title="No users"
          description="Seed the database or click Create user to add one."
        />
      )}

      {users && users.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
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
                      <span className={styles.name}>{u.fullName}</span>
                      {isSelf && <span className={styles.youBadge}>(you)</span>}
                    </td>
                    <td className={styles.muted}>{u.email}</td>
                    <td>
                      <span className={`${styles.role} ${styles[`role_${u.role}`]}`}>
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                    <td>{u.maxHoursPerWeek}</td>
                    <td>
                      {u.skills.length === 0 ? (
                        <span className={styles.muted}>—</span>
                      ) : (
                        <ul className={styles.skills}>
                          {u.skills.map((s) => (
                            <li key={s.skillId}>
                              <span className={styles.skill}>{s.name}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className={styles.actions}>
                      <Link
                        href={`/admin/users/${u.id}`}
                        className={styles.iconBtn}
                        aria-label={`Edit ${u.fullName}`}
                      >
                        <Pencil size={14} />
                      </Link>
                      <button
                        type="button"
                        className={styles.iconBtnDanger}
                        onClick={() => setConfirmDelete(u)}
                        disabled={cannotDelete}
                        title={deleteTitle}
                        aria-label={deleteTitle}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={confirmDelete !== null}
        title="Delete user"
        onClose={() => setConfirmDelete(null)}
        footer={
          <>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setConfirmDelete(null)}
              disabled={deleteBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={handleDelete}
              disabled={deleteBusy}
            >
              {deleteBusy ? 'Deleting…' : 'Delete user'}
            </button>
          </>
        }
      >
        {confirmDelete && (
          <>
            <p>
              Delete <strong>{confirmDelete.fullName}</strong> ({confirmDelete.email})?
            </p>
            <p className={styles.muted}>
              All assignments owned by this user will be removed automatically. Projects and tasks
              are not affected.
            </p>
          </>
        )}
      </Modal>
    </section>
  );
}
