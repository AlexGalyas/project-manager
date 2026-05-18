'use client';

import toast from 'react-hot-toast';

export function toastError(err: unknown, fallback = 'Something went wrong') {
  const message = err instanceof Error ? err.message : fallback;
  toast.error(message);
}

export function toastSuccess(message: string) {
  toast.success(message);
}

export function toastInfo(message: string) {
  toast(message);
}
