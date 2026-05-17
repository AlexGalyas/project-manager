'use client';

import { useEffect, useState } from 'react';
import type { UserSummaryDto } from '@workforce/shared';
import { usersApi } from '@/lib/api/users';
import { toastError } from '@/stores/ui-store';
import { EmptyState } from '@/components/EmptyState';
import { Spinner } from '@/components/Spinner';
import styles from './page.module.scss';

export default function UsersListPage() {
  const [users, setUsers] = useState<UserSummaryDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    usersApi
      .list()
      .then(setUsers)
      .catch((err: Error) => {
        setLoadError(err.message);
        toastError(err, 'Failed to load users');
      });
  }, []);

  return (
    <section>
      <h1 className={styles.heading}>Users</h1>
      <p className={styles.subtitle}>
        Read-only view of all members of this organization, their roles, and their skills.
      </p>

      {loadError && <p className={styles.error}>{loadError}</p>}

      {!users && !loadError && <Spinner />}

      {users && users.length === 0 && (
        <EmptyState title="No users" description="Seed the database to populate the demo." />
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
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td className={styles.muted}>{u.email}</td>
                  <td>
                    <span className={`${styles.role} ${styles[`role_${u.role}`]}`}>
                      {u.role.toLowerCase()}
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
                            <span className={styles.skill}>
                              {s.name} <em className={styles.level}>L{s.level}</em>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
