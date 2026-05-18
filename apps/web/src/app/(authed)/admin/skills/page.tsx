'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Brain, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { SkillDto } from '@workforce/shared';
import { skillsApi } from '@/lib/api/skills';
import { friendlyError } from '@/lib/api-errors';
import { toastError, toastSuccess } from '@/stores/ui-store';
import { PageContainer } from '@/components/layout';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Skeleton,
} from '@/components/ui';
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
    <PageContainer
      title="Skills"
      description="The organization-wide skill catalog. Used by users (capabilities) and tasks (requirements)."
    >
      {loadError && <p className={styles.error}>{loadError}</p>}

      <Card padding="md">
        <form onSubmit={handleCreate} className={styles.addForm}>
          <Input
            placeholder="New skill name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={50}
            className={styles.addInput}
            aria-label="New skill name"
          />
          <Button
            type="submit"
            leftIcon={<Plus size={14} />}
            disabled={newName.trim().length === 0}
            loading={creating}
          >
            Add
          </Button>
        </form>
      </Card>

      <Card padding="none">
        {!skills && !loadError && (
          <div className={styles.skeletonStack}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={styles.skeletonRow}>
                <Skeleton width={120} height={14} />
                <Skeleton width={160} height={12} />
              </div>
            ))}
          </div>
        )}

        {skills && skills.length === 0 && (
          <EmptyState
            icon={<Brain size={20} />}
            title="No skills defined"
            description="Skills help match tasks to employees. Add your first one using the form above."
          />
        )}

        {skills && skills.length > 0 && (
          <ul className={styles.list}>
            {skills.map((s) => (
              <li key={s.id} className={styles.row}>
                {editingId === s.id ? (
                  <div className={styles.editRow}>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      maxLength={50}
                      autoFocus
                      aria-label={`Edit ${s.name}`}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveEdit}
                      loading={editingBusy}
                      aria-label="Save"
                    >
                      <Check size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(null);
                        setEditingName('');
                      }}
                      aria-label="Cancel"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className={styles.skillInfo}>
                      <strong className={styles.skillName}>{s.name}</strong>
                      {s.usage && (
                        <span className={styles.usage}>
                          <Badge variant="neutral" size="sm">
                            {s.usage.users} user{s.usage.users === 1 ? '' : 's'}
                          </Badge>
                          <Badge variant="neutral" size="sm">
                            {s.usage.tasks} task{s.usage.tasks === 1 ? '' : 's'}
                          </Badge>
                        </span>
                      )}
                    </span>
                    <span className={styles.rowActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(s)}
                        aria-label={`Edit ${s.name}`}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(s)}
                        aria-label={`Delete ${s.name}`}
                        className={styles.dangerBtn}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete skill"
        size="sm"
      >
        <Modal.Body>
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
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={deleteBusy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleteBusy}>
            Delete skill
          </Button>
        </Modal.Footer>
      </Modal>
    </PageContainer>
  );
}
