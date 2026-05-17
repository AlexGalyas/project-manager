import type { UserSummaryDto } from '@workforce/shared';
import { apiFetch } from '../api-client';

export const usersApi = {
  list: () => apiFetch<UserSummaryDto[]>('/users'),
  me: () => apiFetch<UserSummaryDto>('/users/me'),
};
