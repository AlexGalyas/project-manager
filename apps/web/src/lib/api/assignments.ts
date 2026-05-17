import type { AssignmentListQuery, AssignmentWithRefsDto } from '@workforce/shared';
import { apiFetch } from '../api-client';

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
  remove: (id: string) => apiFetch<void>(`/assignments/${id}`, { method: 'DELETE' }),
};
