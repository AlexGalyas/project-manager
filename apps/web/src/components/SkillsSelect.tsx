'use client';

import Link from 'next/link';
import type { SkillDto } from '@workforce/shared';
import styles from './SkillsSelect.module.scss';

interface Props {
  allSkills: SkillDto[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyManageHref?: string;
}

export function SkillsSelect({
  allSkills,
  selectedIds,
  onChange,
  emptyManageHref = '/admin/skills',
}: Props) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  }

  if (allSkills.length === 0) {
    return (
      <div className={styles.empty}>
        No skills available.{' '}
        <Link href={emptyManageHref} className={styles.link}>
          Manage skills →
        </Link>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      {allSkills.map((s) => (
        <li key={s.id}>
          <label className={styles.item}>
            <input
              type="checkbox"
              checked={selectedIds.includes(s.id)}
              onChange={() => toggle(s.id)}
            />
            {s.name}
          </label>
        </li>
      ))}
    </ul>
  );
}
