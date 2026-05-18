import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '@/styles/globals.scss';
import { Toaster } from '@/components/Toaster';

export const metadata: Metadata = {
  title: 'Workforce Optimizer',
  description:
    'Distribute tasks across employees, balancing workload, skills, priorities, and deadlines.',
};

// Inline script that resolves the stored theme preference (Zustand persists
// `workforce.theme` to localStorage with shape { state: { preference }, version }).
// It runs before React hydrates so there is no flash of the wrong theme.
const THEME_BOOTSTRAP_SCRIPT = `
(function() {
  try {
    var raw = localStorage.getItem('workforce.theme');
    var pref = 'system';
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.state && parsed.state.preference) pref = parsed.state.preference;
    }
    var resolved = pref;
    if (pref === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
