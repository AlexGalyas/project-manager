import type { AssignmentDto, TaskDto, TaskUpdateInput } from '@workforce/shared';
import { apiFetch } from '../api-client';

export const tasksApi = {
  update: (id: string, body: TaskUpdateInput) =>
    apiFetch<TaskDto>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' }),
  getAssignment: (id: string) => apiFetch<AssignmentDto | null>(`/tasks/${id}/assignment`),
};
