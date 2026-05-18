// Centralised role-to-nav mapping so Sidebar / future Header breadcrumbs
// don't drift apart. Each section appears as a labelled group in the
// collapsed-aware sidebar. Sections shrink to icons only when collapsed.

import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Brain,
  CalendarRange,
  FolderKanban,
  LayoutDashboard,
  Sparkles,
  Users,
} from 'lucide-react';
import type { Role } from '@workforce/shared';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export function navForRole(role: Role): NavSection[] {
  if (role === 'ADMIN') {
    return [
      {
        label: 'Admin',
        items: [
          { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/admin/users', label: 'Users', icon: Users },
          { href: '/admin/skills', label: 'Skills', icon: Brain },
        ],
      },
      {
        label: 'Manager',
        items: [
          { href: '/manager/projects', label: 'Projects', icon: FolderKanban },
          { href: '/manager/optimizer', label: 'Optimizer', icon: Sparkles },
          { href: '/manager/workload', label: 'Workload', icon: BarChart3 },
        ],
      },
    ];
  }
  if (role === 'MANAGER') {
    return [
      {
        label: 'Manager',
        items: [
          { href: '/manager', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/manager/projects', label: 'Projects', icon: FolderKanban },
          { href: '/manager/optimizer', label: 'Optimizer', icon: Sparkles },
          { href: '/manager/workload', label: 'Workload', icon: BarChart3 },
        ],
      },
    ];
  }
  return [
    {
      label: 'Workspace',
      items: [
        { href: '/employee', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/employee/tasks', label: 'My tasks', icon: FolderKanban },
        { href: '/employee/projects', label: 'My projects', icon: FolderKanban },
        { href: '/employee/workload', label: 'My workload', icon: CalendarRange },
      ],
    },
  ];
}
