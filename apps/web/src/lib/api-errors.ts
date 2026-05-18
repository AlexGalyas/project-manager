import { ApiError } from './api-client';

const FRIENDLY_MESSAGES: Record<string, string> = {
  EMAIL_TAKEN: 'This email is already in use.',
  SKILL_NAME_TAKEN: 'A skill with that name already exists.',
  CANNOT_EDIT_OWN_ROLE: 'You cannot change your own role.',
  CANNOT_DELETE_SELF: 'You cannot delete your own account.',
  LAST_ADMIN: 'Cannot remove the last administrator from the organization.',
};

/** Convert an unknown thrown value into a user-facing message. */
export function friendlyError(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiError) {
    const mapped = FRIENDLY_MESSAGES[err.code];
    if (mapped) return mapped;
    if (err.status >= 500) return 'Something went wrong. Please try again.';
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
