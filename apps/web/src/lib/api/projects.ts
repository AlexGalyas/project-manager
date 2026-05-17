import type {
  ProjectCreateInput,
  ProjectDto,
  ProjectUpdateInput,
  ProjectWithTasksDto,
  TaskCreateInput,
  TaskDto,
} from '@workforce/shared';
import { apiFetch } from '../api-client';

export const projectsApi = {
  list: () => apiFetch<ProjectDto[]>('/projects'),
  create: (body: ProjectCreateInput) =>
    apiFetch<ProjectDto>('/projects', { method: 'POST', body: JSON.stringify(body) }),
  detail: (id: string) => apiFetch<ProjectWithTasksDto>(`/projects/${id}`),
  update: (id: string, body: ProjectUpdateInput) =>
    apiFetch<ProjectDto>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<void>(`/projects/${id}`, { method: 'DELETE' }),
  listTasks: (id: string) => apiFetch<TaskDto[]>(`/projects/${id}/tasks`),
  createTask: (id: string, body: TaskCreateInput) =>
    apiFetch<TaskDto>(`/projects/${id}/tasks`, { method: 'POST', body: JSON.stringify(body) }),
};
