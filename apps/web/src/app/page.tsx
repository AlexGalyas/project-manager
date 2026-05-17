'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

export default function Home() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (!token) {
      router.replace('/login');
      return;
    }
    if (!user) {
      void fetchMe();
      return;
    }
    if (user.role === 'ADMIN') router.replace('/admin');
    else if (user.role === 'MANAGER') router.replace('/manager');
    else router.replace('/employee');
  }, [token, user, router, fetchMe]);

  return null;
}
