import type { SkillDto } from '@workforce/shared';
import { apiFetch } from '../api-client';

export const skillsApi = {
  list: () => apiFetch<SkillDto[]>('/skills'),
};
