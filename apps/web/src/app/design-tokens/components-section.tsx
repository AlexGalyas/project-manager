'use client';

import { useState } from 'react';
import { Brain, FolderKanban, Mail, Plus, Trash2, User } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  Dropdown,
  EmptyState,
  Input,
  Modal,
  SectionHeader,
  Select,
  Skeleton,
  Spinner,
  Switch,
  Tabs,
  Textarea,
  Tooltip,
} from '@/components/ui';
import styles from './page.module.scss';

export function ComponentsSection() {
  const [modal, setModal] = useState(false);
  const [tab, setTab] = useState('overview');
  const [checked, setChecked] = useState(true);
  const [switchOn, setSwitchOn] = useState(false);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHeading}>Primitives</h2>
      <p className={styles.note}>
        First pass at the design system. Each subsection below uses the same Card / Badge / Avatar
        / etc. components you'll see across the rebuilt pages in Step 9+.
      </p>

      <SectionHeader
        as="h3"
        title="Buttons"
        description="Primary / secondary / ghost / outline / danger. Three sizes. Loading + icon variants."
      />
      <div className={styles.row}>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="danger">Danger</Button>
        <Button disabled>Disabled</Button>
      </div>
      <div className={styles.row}>
        <Button size="sm" leftIcon={<Plus size={14} />}>
          New task
        </Button>
        <Button size="md" leftIcon={<Plus size={14} />}>
          New project
        </Button>
        <Button size="lg" leftIcon={<Plus size={16} />}>
          Run optimizer
        </Button>
        <Button loading>Saving…</Button>
        <Button variant="danger" leftIcon={<Trash2 size={14} />}>
          Delete
        </Button>
      </div>

      <SectionHeader as="h3" title="Badges" description="Pills for status, source, and counts." />
      <div className={styles.row}>
        <Badge>default</Badge>
        <Badge variant="accent">manual</Badge>
        <Badge variant="info">auto</Badge>
        <Badge variant="success" dot>
          done
        </Badge>
        <Badge variant="warning" dot>
          in progress
        </Badge>
        <Badge variant="danger" dot>
          overloaded
        </Badge>
        <Badge variant="neutral">todo</Badge>
      </div>

      <SectionHeader
        as="h3"
        title="Avatars"
        description="Hash-coloured initials by default; consumer can pass an image src."
      />
      <div className={styles.row} style={{ alignItems: 'center' }}>
        <Avatar name="Admin Demo" size="xs" />
        <Avatar name="Manager One" size="sm" />
        <Avatar name="Employee 5" size="md" />
        <Avatar name="Newbie Test" size="lg" />
        <Avatar name="Sixth Admin" size="xl" />
        <Avatar name="Accent Tone" tone="accent" size="md" />
      </div>

      <SectionHeader
        as="h3"
        title="Inputs"
        description="Field shell carries label / helper / error. Same hairline border across sizes."
      />
      <div className={styles.formGrid}>
        <Input label="Email" type="email" leftIcon={<Mail size={14} />} placeholder="you@demo.local" />
        <Input
          label="Full name"
          helper="Visible to anyone in your organization"
          placeholder="Jane Doe"
        />
        <Input
          label="Project name"
          error="A project named 'Onboarding Revamp' already exists."
          defaultValue="Onboarding Revamp"
        />
        <Select
          label="Role"
          options={[
            { value: 'EMPLOYEE', label: 'Employee' },
            { value: 'MANAGER', label: 'Manager' },
            { value: 'ADMIN', label: 'Admin' },
          ]}
        />
        <Textarea label="Description" placeholder="Optional context for the team" rows={3} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Checkbox label="Replace existing assignments" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <Checkbox label="Locked by manager" indeterminate />
          <Switch label="Dark mode follows system" checked={switchOn} onChange={(e) => setSwitchOn(e.target.checked)} />
        </div>
      </div>

      <SectionHeader as="h3" title="Cards" description="Default / interactive / elevated." />
      <div className={styles.cardsRow}>
        <Card padding="lg">
          <CardHeader>
            <strong>Migrate auth middleware</strong>
            <span className={styles.note}>Onboarding Revamp · 14h · due in 3 days</span>
          </CardHeader>
          <CardBody>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <Badge variant="accent">manual</Badge>
              <Badge variant="warning" dot>
                in progress
              </Badge>
              <Badge variant="neutral">React</Badge>
              <Badge variant="neutral">TypeScript</Badge>
            </div>
            <p className={styles.note}>
              Refactor the legacy session middleware to use the new RolesGuard. Requires
              coordination with the team backend lead.
            </p>
          </CardBody>
          <CardFooter>
            <Button variant="secondary" size="sm">
              Cancel
            </Button>
            <Button size="sm">Save changes</Button>
          </CardFooter>
        </Card>
        <Card variant="interactive" padding="lg">
          <CardHeader>
            <strong>Interactive</strong>
            <span className={styles.note}>Hover me. Cursor + lift shadow.</span>
          </CardHeader>
          <CardBody>
            <p className={styles.note}>
              Used for list rows that link to a detail page.
            </p>
          </CardBody>
        </Card>
        <Card variant="elevated" padding="lg">
          <CardHeader>
            <strong>Elevated</strong>
            <span className={styles.note}>For floating panels.</span>
          </CardHeader>
          <CardBody>
            <p className={styles.note}>Uses --shadow-md by default.</p>
          </CardBody>
        </Card>
      </div>

      <SectionHeader as="h3" title="Tabs" description="Underline indicator slides on change." />
      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview', icon: <FolderKanban size={14} /> },
          { key: 'tasks', label: 'Tasks' },
          { key: 'workload', label: 'Workload' },
          { key: 'team', label: 'Team', icon: <User size={14} /> },
        ]}
        activeKey={tab}
        onChange={setTab}
      />
      <p className={styles.note}>
        Currently selected: <code>{tab}</code>
      </p>

      <SectionHeader as="h3" title="Modal" description="Backdrop blur, Esc, click-outside, size variants." />
      <div className={styles.row}>
        <Button onClick={() => setModal(true)}>Open modal</Button>
      </div>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Delete user"
        size="sm"
      >
        <Modal.Body>
          <p>
            Delete <strong>Newbie Test</strong> (newbie@demo.local)?
          </p>
          <p className={styles.note}>
            All assignments owned by this user will be removed automatically. Projects and tasks
            are not affected.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => setModal(false)}>
            Delete user
          </Button>
        </Modal.Footer>
      </Modal>

      <SectionHeader
        as="h3"
        title="Dropdown + Tooltip"
        description="Keyboard navigable. Tooltip auto-flips near viewport edges."
      />
      <div className={styles.row}>
        <Dropdown
          trigger={<Button variant="secondary">Actions</Button>}
          items={[
            { label: 'Edit', icon: <Plus size={14} />, onSelect: () => {} },
            { label: 'Duplicate', description: 'Copy to a new project', onSelect: () => {} },
            { kind: 'separator' },
            { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onSelect: () => {} },
          ]}
        />
        <Tooltip content="Locked — optimizer will not change this assignment.">
          <Button variant="ghost" leftIcon={<Brain size={14} />}>
            Hover for tooltip
          </Button>
        </Tooltip>
      </div>

      <SectionHeader as="h3" title="Empty state" />
      <EmptyState
        icon={<FolderKanban size={20} />}
        title="No projects yet"
        description="Create your first project to start assigning tasks."
        action={<Button leftIcon={<Plus size={14} />}>Create project</Button>}
      />

      <SectionHeader
        as="h3"
        title="Loading"
        description="Spinner for one-shot ops; Skeleton for surfaces waiting on data."
      />
      <div className={styles.row}>
        <Spinner size="xs" inline label="" />
        <Spinner size="sm" inline label="" />
        <Spinner size="md" />
        <Spinner size="lg" label="Optimizing" />
      </div>
      <div className={styles.skeletonStack}>
        <Skeleton width={160} height={20} />
        <Skeleton lines={3} />
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <Skeleton circle width={32} height={32} />
          <Skeleton width={200} height={14} />
        </div>
      </div>
    </section>
  );
}
