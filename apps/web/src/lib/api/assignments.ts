import type {
  AssignmentCreateInput,
  AssignmentDto,
  AssignmentListQuery,
  AssignmentMutationResultDto,
  AssignmentUpdateInput,
  AssignmentWarningDto,
  AssignmentWithRefsDto,
} from '@workforce/shared';
import { apiFetch, ApiError } from '../api-client';

function toQuery(filter: AssignmentListQuery): string {
  const params = new URLSearchParams();
  if (filter.userId) params.set('userId', filter.userId);
  if (filter.projectId) params.set('projectId', filter.projectId);
  const q = params.toString();
  return q ? `?${q}` : '';
}

export const assignmentsApi = {
  list: (filter: AssignmentListQuery = {}) =>
    apiFetch<AssignmentWithRefsDto[]>(`/assignments${toQuery(filter)}`),
  create: (body: AssignmentCreateInput) =>
    apiFetch<AssignmentMutationResultDto>('/assignments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: AssignmentUpdateInput) =>
    apiFetch<AssignmentMutationResultDto>(`/assignments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  remove: (id: string) => apiFetch<void>(`/assignments/${id}`, { method: 'DELETE' }),
  lock: (id: string) =>
    apiFetch<AssignmentDto>(`/assignments/${id}/lock`, { method: 'POST' }),
  unlock: (id: string) =>
    apiFetch<AssignmentDto>(`/assignments/${id}/unlock`, { method: 'POST' }),
};

/**
 * Inspect an ApiError thrown from create/update. If it's the 422
 * ASSIGNMENT_WARNINGS shape, return the warnings array so the UI can offer
 * a "force" retry. Returns null for any other error.
 */
export function extractAssignmentWarnings(err: unknown): AssignmentWarningDto[] | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code !== 'ASSIGNMENT_WARNINGS') return null;
  const details = err.details as { warnings?: AssignmentWarningDto[] } | undefined;
  return details?.warnings ?? null;
}
