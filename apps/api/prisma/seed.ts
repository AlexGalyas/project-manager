// Seed for Workforce Optimizer MVP.
// Deterministic by design: a fixed PRNG seed makes `pnpm db:reset && pnpm db:seed`
// produce the same demo dataset across machines.

import { PrismaClient, Role, TaskStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// mulberry32 — small, fast, deterministic PRNG.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260517);
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pickN = <T>(arr: readonly T[], n: number): T[] => {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length > 0; i += 1) {
    const idx = Math.floor(rand() * pool.length);
    out.push(pool.splice(idx, 1)[0]!);
  }
  return out;
};

const SKILL_NAMES = [
  'React',
  'Node.js',
  'PostgreSQL',
  'TypeScript',
  'Figma',
  'NestJS',
  'Docker',
  'Python',
  'GraphQL',
  'CSS',
] as const;

const PROJECT_NAMES = [
  'Onboarding Revamp',
  'Billing Migration',
  'Mobile Companion App',
  'Analytics Dashboard',
  'Internal Design System',
  'Search Relevance',
  'Customer Portal v2',
  'Data Warehouse Cutover',
] as const;

const TASK_VERBS = ['Design', 'Implement', 'Test', 'Document', 'Review', 'Refactor', 'Optimize', 'Deploy'] as const;
const TASK_NOUNS = [
  'login flow',
  'API endpoint',
  'dashboard widget',
  'data migration',
  'background worker',
  'error handling',
  'caching layer',
  'permission model',
  'audit log',
  'reporting view',
] as const;

async function main() {
  console.log('[seed] clearing existing data');
  // Order matters: children before parents.
  await prisma.assignment.deleteMany();
  await prisma.taskDependency.deleteMany();
  await prisma.taskSkill.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.userSkill.deleteMany();
  await prisma.user.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: { name: 'Demo Studio', plan: 'demo' },
  });
  console.log(`[seed] org: ${org.name} (${org.id})`);

  const passwordHash = await bcrypt.hash('password', 10);

  const admin = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'admin@demo.local',
      passwordHash,
      fullName: 'Admin Demo',
      role: Role.ADMIN,
      maxHoursPerWeek: 40,
    },
  });

  const managers = await Promise.all(
    [1, 2].map((i) =>
      prisma.user.create({
        data: {
          organizationId: org.id,
          email: `manager${i}@demo.local`,
          passwordHash,
          fullName: `Manager ${i}`,
          role: Role.MANAGER,
          maxHoursPerWeek: 40,
        },
      }),
    ),
  );

  const employees = await Promise.all(
    Array.from({ length: 15 }, (_, i) => i + 1).map((n) =>
      prisma.user.create({
        data: {
          organizationId: org.id,
          email: `emp${n}@demo.local`,
          passwordHash,
          fullName: `Employee ${n}`,
          role: Role.EMPLOYEE,
          maxHoursPerWeek: 40,
        },
      }),
    ),
  );
  console.log(`[seed] users: 1 admin, ${managers.length} managers, ${employees.length} employees`);

  const skills = await Promise.all(
    SKILL_NAMES.map((name) =>
      prisma.skill.create({
        data: { organizationId: org.id, name },
      }),
    ),
  );
  console.log(`[seed] skills: ${skills.length}`);

  for (const emp of employees) {
    const empSkills = pickN(skills, randInt(1, 3));
    await Promise.all(
      empSkills.map((s) =>
        prisma.userSkill.create({
          data: { userId: emp.id, skillId: s.id, level: randInt(1, 5) },
        }),
      ),
    );
  }
  console.log('[seed] user skills assigned');

  const now = new Date();
  const projects = await Promise.all(
    PROJECT_NAMES.map((name, i) =>
      prisma.project.create({
        data: {
          organizationId: org.id,
          name,
          description: `Demo project ${i + 1} — ${name.toLowerCase()}.`,
          priority: randInt(1, 5),
          startDate: now,
          endDate: new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000),
        },
      }),
    ),
  );
  console.log(`[seed] projects: ${projects.length}`);

  // Create 60 tasks spread roughly evenly across projects.
  const tasks: { id: string; projectId: string; createdIdx: number }[] = [];
  for (let i = 0; i < 60; i += 1) {
    const project = projects[i % projects.length]!;
    const verb = TASK_VERBS[randInt(0, TASK_VERBS.length - 1)]!;
    const noun = TASK_NOUNS[randInt(0, TASK_NOUNS.length - 1)]!;
    const durationHours = randInt(4, 40);
    const daysOut = randInt(2, 28);
    const deadline = new Date(now.getTime() + daysOut * 24 * 60 * 60 * 1000);
    const priority = randInt(1, 5);

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        name: `${verb} ${noun} #${i + 1}`,
        durationHours,
        deadline,
        priority,
        status: TaskStatus.TODO,
      },
    });

    // 1–2 required skills per task.
    const requiredSkills = pickN(skills, randInt(1, 2));
    await Promise.all(
      requiredSkills.map((s) =>
        prisma.taskSkill.create({
          data: { taskId: task.id, skillId: s.id },
        }),
      ),
    );

    tasks.push({ id: task.id, projectId: project.id, createdIdx: i });
  }
  console.log(`[seed] tasks: ${tasks.length}`);

  // 30% of tasks get a dependency. To avoid cycles, depend only on earlier tasks
  // in the same project.
  let depsCreated = 0;
  for (const t of tasks) {
    if (rand() >= 0.3) continue;
    const candidates = tasks.filter(
      (other) => other.projectId === t.projectId && other.createdIdx < t.createdIdx,
    );
    if (candidates.length === 0) continue;
    const dep = candidates[randInt(0, candidates.length - 1)]!;
    await prisma.taskDependency.create({
      data: { taskId: t.id, dependsOnTaskId: dep.id },
    });
    depsCreated += 1;
  }
  console.log(`[seed] task dependencies: ${depsCreated}`);

  console.log('\n[seed] done.');
  console.log('Credentials (password: "password"):');
  console.log(`  admin:     ${admin.email}`);
  managers.forEach((m) => console.log(`  manager:   ${m.email}`));
  console.log(`  employees: emp1@demo.local ... emp${employees.length}@demo.local`);
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
