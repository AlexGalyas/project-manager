import type { Metadata } from 'next';
import '@/styles/globals.scss';
import { Toaster } from '@/components/Toaster';

export const metadata: Metadata = {
  title: 'Workforce Optimizer',
  description: 'Distribute tasks across employees, balancing workload, skills, priorities, and deadlines.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
