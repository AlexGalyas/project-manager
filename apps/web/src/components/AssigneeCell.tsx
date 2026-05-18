'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Lock, LockOpen, UserPlus, X } from 'lucide-react';
import type {
  AssignmentCreateInput,
  AssignmentDto,
  AssignmentMutationResultDto,
  AssignmentUpdateInput,
  AssignmentWarningDto,
  TaskDto,
  UserSummaryDto,
  WorkloadEntryDto,
} from '@workforce/shared';
import {
  assignmentsApi,
  extractAssignmentWarnings,
} from '@/lib/api/assignments';
import { toastError, toastSuccess } from '@/stores/ui-store';
import { Modal } from './Modal';
import { AssignmentWarningsModal } from './AssignmentWarningsModal';
import styles from './AssigneeCell.module.scss';

interface Props {
  task: TaskDto;
  employees: UserSummaryDto[];
  workload: WorkloadEntryDto[];
  /** Called whenever an assignment changes (create/update/delete/lock toggle). */
  onChanged: () => void | Promise<void>;
}

interface PendingAction {
  kind: 'create' | 'update';
  input: AssignmentCreateInput | AssignmentUpdateInput;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function AssigneeCell({ task, employees, workload, onChanged }: Props) {
  const a = task.assignment;
  const assignedUser = useMemo(
    () => (a ? employees.find((e) => e.id === a.userId) : undefined),
    [a, employees],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [hoursInput, setHoursInput] = useState(String(a?.plannedHours ?? task.durationHours));
  const [busy, setBusy] = useState(false);

  // Warning-modal state: if force=false produced warnings, hold them here +
  // remember which mutation to retry on confirm.
  const [warnings, setWarnings] = useState<AssignmentWarningDto[] | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);

  const requiredSkillIds = useMemo(() => task.skills.map((s) => s.skillId), [task.skills]);

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((x, y) => {
      const xMissing = requiredSkillIds.filter((s) => !x.skills.some((sk) => sk.skillId === s)).length;
      const yMissing = requiredSkillIds.filter((s) => !y.skills.some((sk) => sk.skillId === s)).length;
      if (xMissing !== yMissing) return xMissing - yMissing;
      return x.fullName.localeCompare(y.fullName);
    });
  }, [employees, requiredSkillIds]);

  const loadByUserId = useMemo(() => {
    const m = new Map<string, WorkloadEntryDto>();
    workload.forEach((w) => m.set(w.userId, w));
    return m;
  }, [workload]);

  async function runMutation(action: PendingAction, force: boolean) {
    setBusy(true);
    try {
      let result: AssignmentMutationResultDto;
      if (action.kind === 'create') {
        result = await assignmentsApi.create({ ...(action.input as AssignmentCreateInput), force });
      } else {
        result = await assignmentsApi.update(a!.id, {
          ...(action.input as AssignmentUpdateInput),
          force,
        });
      }
      // Success — close any warning modal, refresh.
      setWarnings(null);
      setPendingAction(null);
      setPickerOpen(false);
      toastSuccess(action.kind === 'create' ? 'Assigned' : 'Assignment updated');
      if (result.warnings.length > 0) {
        // Forced with warnings — surface a soft toast so manager knows
        toastSuccess(`Saved with ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`);
      }
      await onChanged();
    } catch (err) {
      const w = extractAssignmentWarnings(err);
      if (w) {
        setWarnings(w);
        setPendingAction(action);
      } else {
        toastError(err, action.kind === 'create' ? 'Assign failed' : 'Update failed');
      }
    } finally {
      setBusy(false);
    }
  }

  async function pickEmployee(userId: string) {
    if (a) {
      // Existing — change assignee via PATCH
      if (a.userId === userId) {
        setPickerOpen(false);
        return;
      }
      await runMutation(
        { kind: 'update', input: { userId, force: false } },
        false,
      );
    } else {
      // Fresh — POST
      await runMutation(
        {
          kind: 'create',
          input: {
            taskId: task.id,
            userId,
            plannedHours: Number.parseFloat(hoursInput) || task.durationHours,
            force: false,
          },
        },
        false,
      );
    }
  }

  async function handleHoursBlur() {
    if (!a) return;
    const next = Number.parseFloat(hoursInput);
    if (!Number.isFinite(next) || next <= 0) {
      setHoursInput(String(a.plannedHours));
      return;
    }
    if (next === a.plannedHours) return;
    await runMutation(
      { kind: 'update', input: { plannedHours: next, force: false } },
      false,
    );
  }

  async function toggleLock() {
    if (!a) return;
    setBusy(true);
    try {
      if (a.lockedByManager) await assignmentsApi.unlock(a.id);
      else await assignmentsApi.lock(a.id);
      toastSuccess(a.lockedByManager ? 'Unlocked' : 'Locked');
      await onChanged();
    } catch (err) {
      toastError(err, 'Failed to update lock');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!a) return;
    setBusy(true);
    try {
      await assignmentsApi.remove(a.id);
      toastSuccess('Unassigned');
      setDeleteOpen(false);
      await onChanged();
    } catch (err) {
      toastError(err, 'Failed to unassign');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.cell}>
      {a && assignedUser ? (
        <>
          <button
            type="button"
            className={styles.assignee}
            onClick={() => setPickerOpen(true)}
            disabled={busy}
            title="Click to change assignee"
          >
            <span className={styles.avatar}>{initials(assignedUser.fullName)}</span>
            <span className={styles.name}>{assignedUser.fullName}</span>
          </button>
          <button
            type="button"
            className={styles.lockBtn}
            onClick={toggleLock}
            disabled={busy}
            title={
              a.lockedByManager
                ? 'Locked — optimizer will not change this'
                : 'Unlocked — optimizer may reassign'
            }
            aria-label={a.lockedByManager ? 'Unlock' : 'Lock'}
          >
            {a.lockedByManager ? <Lock size={12} /> : <LockOpen size={12} />}
          </button>
          <span className={`${styles.sourceBadge} ${styles[`source_${a.source}`]}`}>
            {a.source === 'MANUAL' ? 'manual' : 'auto'}
          </span>
          <input
            type="number"
            min={0.5}
            step={0.5}
            className={styles.hoursInput}
            value={hoursInput}
            onChange={(e) => setHoursInput(e.target.value)}
            onBlur={handleHoursBlur}
            disabled={busy}
            title="Planned hours"
            aria-label="Planned hours"
          />
          <span className={styles.hoursSuffix}>h</span>
          <button
            type="button"
            className={styles.unassignBtn}
            onClick={() => setDeleteOpen(true)}
            disabled={busy}
            aria-label="Unassign"
            title="Unassign"
          >
            <X size={12} />
          </button>
        </>
      ) : (
        <button
          type="button"
          className={styles.assignTrigger}
          onClick={() => {
            setHoursInput(String(task.durationHours));
            setPickerOpen(true);
          }}
          disabled={busy}
        >
          <UserPlus size={12} />
          Assign…
        </button>
      )}

      <Modal
        open={pickerOpen}
        title={a ? `Change assignee · ${task.name}` : `Assign · ${task.name}`}
        onClose={() => setPickerOpen(false)}
        size="md"
      >
        <PickerBody
          requiredSkillIds={requiredSkillIds}
          requiredSkillNames={task.skills.map((s) => s.name)}
          sortedEmployees={sortedEmployees}
          loadByUserId={loadByUserId}
          currentUserId={a?.userId ?? null}
          onPick={(id) => pickEmployee(id)}
          busy={busy}
        />
      </Modal>

      <AssignmentWarningsModal
        open={warnings !== null}
        warnings={warnings ?? []}
        busy={busy}
        onCancel={() => {
          setWarnings(null);
          setPendingAction(null);
        }}
        onConfirm={() => {
          if (pendingAction) {
            void runMutation(pendingAction, true);
          }
        }}
      />

      <Modal
        open={deleteOpen}
        title="Unassign task"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={styles.modalCancel}
              onClick={() => setDeleteOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.modalDanger}
              onClick={handleDelete}
              disabled={busy}
            >
              {busy ? 'Removing…' : 'Unassign'}
            </button>
          </>
        }
      >
        <p>
          Remove the assignment for <strong>{task.name}</strong>?
        </p>
        {a?.lockedByManager && (
          <p className={styles.muted}>
            This assignment is locked. The lock prevents the optimizer from changing it; removing
            here is allowed regardless.
          </p>
        )}
      </Modal>
    </div>
  );
}

function PickerBody({
  requiredSkillIds,
  requiredSkillNames,
  sortedEmployees,
  loadByUserId,
  currentUserId,
  onPick,
  busy,
}: {
  requiredSkillIds: string[];
  requiredSkillNames: string[];
  sortedEmployees: UserSummaryDto[];
  loadByUserId: Map<string, WorkloadEntryDto>;
  currentUserId: string | null;
  onPick: (userId: string) => void | Promise<void>;
  busy: boolean;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedEmployees;
    return sortedEmployees.filter(
      (e) => e.fullName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q),
    );
  }, [query, sortedEmployees]);

  return (
    <div>
      <input
        type="search"
        className={styles.search}
        placeholder="Search employees…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {requiredSkillIds.length > 0 && (
        <p className={styles.requiredSkills}>
          Required skills: {requiredSkillNames.join(', ')}
        </p>
      )}
      <ul className={styles.empList}>
        {filtered.length === 0 && (
          <li className={styles.empEmpty}>No employees match.</li>
        )}
        {filtered.map((emp) => {
          const missing = requiredSkillIds.filter(
            (s) => !emp.skills.some((sk) => sk.skillId === s),
          );
          const missingNames = missing
            .map((id) => requiredSkillNames[requiredSkillIds.indexOf(id)] ?? id)
            .filter(Boolean);
          const w = loadByUserId.get(emp.id);
          const isCurrent = emp.id === currentUserId;
          return (
            <li key={emp.id}>
              <button
                type="button"
                className={`${styles.empRow} ${isCurrent ? styles.empCurrent : ''}`}
                onClick={() => onPick(emp.id)}
                disabled={busy || isCurrent}
              >
                <span className={styles.empAvatar}>{initials(emp.fullName)}</span>
                <span className={styles.empMain}>
                  <span className={styles.empName}>
                    {emp.fullName}
                    {isCurrent && <span className={styles.currentTag}>· current</span>}
                  </span>
                  <span className={styles.empMeta}>
                    {emp.role.toLowerCase()} · {w ? `${w.plannedHours}/${w.maxHours}h` : `0/${emp.maxHoursPerWeek}h`}
                    {missingNames.length > 0 && (
                      <span className={styles.empMissing}> · missing: {missingNames.join(', ')}</span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
