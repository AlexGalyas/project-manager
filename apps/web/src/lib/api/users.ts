import type {
  UserCreateInput,
  UserPasswordChangeInput,
  UserSetSkillsInput,
  UserSummaryDto,
  UserUpdateInput,
} from '@workforce/shared';
import { apiFetch } from '../api-client';

export const usersApi = {
  list: () => apiFetch<UserSummaryDto[]>('/users'),
  me: () => apiFetch<UserSummaryDto>('/users/me'),
  get: (id: string) => apiFetch<UserSummaryDto>(`/users/${id}`),
  create: (body: UserCreateInput) =>
    apiFetch<UserSummaryDto>('/users', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: UserUpdateInput) =>
    apiFetch<UserSummaryDto>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }),
  changePassword: (id: string, body: UserPasswordChangeInput) =>
    apiFetch<void>(`/users/${id}/password`, { method: 'PATCH', body: JSON.stringify(body) }),
  setSkills: (id: string, body: UserSetSkillsInput) =>
    apiFetch<UserSummaryDto>(`/users/${id}/skills`, { method: 'PUT', body: JSON.stringify(body) }),
};
