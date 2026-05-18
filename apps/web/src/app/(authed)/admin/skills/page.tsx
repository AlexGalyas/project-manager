'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Brain, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { SkillDto } from '@workforce/shared';
import { skillsApi } from '@/lib/api/skills';
import { friendlyError } from '@/lib/api-errors';
import { toastError, toastSuccess } from '@/stores/ui-store';
import { EmptyState } from '@/components/EmptyState';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import styles from './page.module.scss';

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<SkillDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingBusy, setEditingBusy] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<SkillDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function refresh() {
    try {
      setLoadError(null);
      setSkills(await skillsApi.list());
    } catch (err) {
      const message = friendlyError(err, 'Failed to load skills');
      setLoadError(message);
      toastError(err, message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await skillsApi.create({ name });
      toastSuccess(`Skill "${name}" added`);
      setNewName('');
      await refresh();
    } catch (err) {
      toastError(err, friendlyError(err, 'Failed to add skill'));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(skill: SkillDto) {
    setEditingId(skill.id);
    setEditingName(skill.name);
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;
    setEditingBusy(true);
    try {
      await skillsApi.update(editingId, { name });
      toastSuccess('Skill updated');
      setEditingId(null);
      setEditingName('');
      await refresh();
    } catch (err) {
      toastError(err, friendlyError(err, 'Failed to update skill'));
    } finally {
      setEditingBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleteBusy(true);
    try {
      await skillsApi.remove(confirmDelete.id);
      toastSuccess(`Skill "${confirmDelete.name}" deleted`);
      setConfirmDelete(null);
      await refresh();
    } catch (err) {
      toastError(err, friendlyError(err, 'Failed to delete skill'));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <section className={styles.page}>
      <header>
        <h1 className={styles.heading}>
          <Brain size={20} /> Skills
        </h1>
        <p className={styles.subtitle}>
          The organization-wide skill catalog. Skills here are referenced by users (capabilities)
          and tasks (requirements).
        </p>
      </header>

      <form className={styles.addForm} onSubmit={handleCreate}>
        <input
          className={styles.addInput}
          placeholder="New skill name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={50}
        />
        <button
          type="submit"
          className={styles.addBtn}
          disabled={creating || newName.trim().length === 0}
        >
          <Plus size={16} /> {creating ? 'Adding…' : 'Add'}
        </button>
      </form>

      {loadError && <p className={styles.error}>{loadError}</p>}

      {!skills && !loadError && <Spinner />}

      {skills && skills.length === 0 && (
        <EmptyState
          title="No skills yet"
          description="Add your first skill using the field above."
        />
      )}

      {skills && skills.length > 0 && (
        <ul className={styles.list}>
          {skills.map((s) => (
            <li key={s.id} className={styles.row}>
              {editingId === s.id ? (
                <div className={styles.editRow}>
                  <input
                    className={styles.editInput}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                    maxLength={50}
                  />
                  <button
                    type="button"
                    className={styles.iconBtnPrimary}
                    onClick={handleSaveEdit}
                    disabled={editingBusy}
                    aria-label="Save"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => {
                      setEditingId(null);
                      setEditingName('');
                    }}
                    aria-label="Cancel"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.skillInfo}>
                    <strong className={styles.skillName}>{s.name}</strong>
                    <span className={styles.usage}>
                      {s.usage
                        ? `used by ${s.usage.users} user${s.usage.users === 1 ? '' : 's'}, ${s.usage.tasks} task${s.usage.tasks === 1 ? '' : 's'}`
                        : '—'}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => startEdit(s)}
                      aria-label={`Edit ${s.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtnDanger}
                      onClick={() => setConfirmDelete(s)}
                      aria-label={`Delete ${s.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={confirmDelete !== null}
        title="Delete skill"
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
              {deleteBusy ? 'Deleting…' : 'Delete skill'}
            </button>
          </>
        }
      >
        {confirmDelete && (
          <>
            <p>
              Delete <strong>{confirmDelete.name}</strong>?
            </p>
            {confirmDelete.usage &&
            (confirmDelete.usage.users > 0 || confirmDelete.usage.tasks > 0) ? (
              <p className={styles.warn}>
                This skill is used by {confirmDelete.usage.users} user
                {confirmDelete.usage.users === 1 ? '' : 's'} and {confirmDelete.usage.tasks} task
                {confirmDelete.usage.tasks === 1 ? '' : 's'}. Deleting it will remove these
                associations.
              </p>
            ) : (
              <p className={styles.muted}>This skill is not in use.</p>
            )}
          </>
        )}
      </Modal>
    </section>
  );
}
