import type { WorkloadEntryDto } from '@workforce/shared';
import { apiFetch } from '../api-client';

export const workloadApi = {
  list: () => apiFetch<WorkloadEntryDto[]>('/workload'),
  me: () => apiFetch<WorkloadEntryDto>('/workload/me'),
};
