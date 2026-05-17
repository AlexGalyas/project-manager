export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type WorkloadStatus = 'under' | 'normal' | 'over';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  organizationId: string;
  maxHoursPerWeek: number;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
