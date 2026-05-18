import type { SkillCreateInput, SkillDto, SkillUpdateInput } from '@workforce/shared';
import { apiFetch } from '../api-client';

export const skillsApi = {
  list: () => apiFetch<SkillDto[]>('/skills'),
  create: (body: SkillCreateInput) =>
    apiFetch<SkillDto>('/skills', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: SkillUpdateInput) =>
    apiFetch<SkillDto>(`/skills/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<void>(`/skills/${id}`, { method: 'DELETE' }),
};
