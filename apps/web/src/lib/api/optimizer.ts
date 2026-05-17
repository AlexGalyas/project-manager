import type { OptimizerResultDto, OptimizerRunInput } from '@workforce/shared';
import { apiFetch } from '../api-client';

export const optimizerApi = {
  run: (body: OptimizerRunInput) =>
    apiFetch<OptimizerResultDto>('/optimizer/run', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
