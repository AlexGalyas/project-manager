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
    [1].map((i) =>
      prisma.user.create({
        data: {
          organizationId: org.id,
          email: `manager${i}@demo.local`,
          passwordHash,
          fullName: `Manager ${i}`,
          role: Role.MANAGER,
          maxHoursPerWeek: 40,
          maxHoursPerDay: 8,
        },
      }),
    ),
  );

  const employees = await Promise.all(
    Array.from({ length: 5 }, (_, i) => i + 1).map((n) =>
      prisma.user.create({
        data: {
          organizationId: org.id,
          email: `emp${n}@demo.local`,
          passwordHash,
          fullName: `Employee ${n}`,
          role: Role.EMPLOYEE,
          maxHoursPerWeek: 40,
          maxHoursPerDay: 8,
        },
      }),
    ),
  );
  console.log(`[seed] users: 1 admin, ${managers.length} manager, ${employees.length} employees`);

  const skills = await Promise.all(
    SKILL_NAMES.map((name) =>
      prisma.skill.create({
        data: { organizationId: org.id, name },
      }),
    ),
  );
  console.log(`[seed] skills: ${skills.length}`);

  // Spread skills so every skill has at least one employee — otherwise tasks
  // requiring it would always end up MISSING_SKILLS-unassigned. Round-robin
  // assign each skill to one employee, then top up each employee to 3–4 skills
  // with random extras.
  const skillsByUser = new Map<string, Set<string>>(
    employees.map((e) => [e.id, new Set<string>()]),
  );
  for (let i = 0; i < skills.length; i += 1) {
    const emp = employees[i % employees.length]!;
    skillsByUser.get(emp.id)!.add(skills[i]!.id);
  }
  for (const emp of employees) {
    const target = randInt(3, 4);
    while (skillsByUser.get(emp.id)!.size < target) {
      const extra = skills[randInt(0, skills.length - 1)]!;
      skillsByUser.get(emp.id)!.add(extra.id);
    }
    for (const skillId of skillsByUser.get(emp.id)!) {
      await prisma.userSkill.create({
        data: { userId: emp.id, skillId, level: randInt(1, 5) },
      });
    }
  }
  console.log('[seed] user skills assigned');

  const now = new Date();
  // 4 projects — pick the first four names from the catalog above.
  const projectNamesForDemo = PROJECT_NAMES.slice(0, 4);
  const projects = await Promise.all(
    projectNamesForDemo.map((name, i) =>
      prisma.project.create({
        data: {
          organizationId: org.id,
          name,
          description: `Demo project ${i + 1} — ${name.toLowerCase()}.`,
          priority: randInt(1, 5),
          startDate: now,
          // 6 weeks (42 days) horizon, matches the task-deadline spread below.
          endDate: new Date(now.getTime() + 42 * 24 * 60 * 60 * 1000),
        },
      }),
    ),
  );
  console.log(`[seed] projects: ${projects.length}`);

  // Total task hours budget: team daily capacity × 30 working days × 0.7.
  // Team daily capacity = sum of every employee's maxHoursPerDay (= 8 × N).
  // With 5 employees × 8h × 30 days × 0.7 = 840h of headroom. We aim for
  // ~55% utilization (≈ 460h) so the optimizer comfortably fits everything
  // and the demo still shows daily-distribution behavior.
  const teamDailyCapacityHours = employees.reduce((s, e) => s + 8, 0); // explicit
  const TASK_HOUR_BUDGET = Math.floor(teamDailyCapacityHours * 30 * 0.7);
  const TARGET_UTILIZATION = 0.55;
  const targetHours = Math.floor(TASK_HOUR_BUDGET * TARGET_UTILIZATION);

  // Generate tasks one-by-one until we hit `targetHours` (and a hard cap on
  // task count so the demo doesn't explode).
  const tasks: { id: string; projectId: string; createdIdx: number }[] = [];
  let totalHours = 0;
  const MAX_TASKS = 30;
  for (let i = 0; i < MAX_TASKS; i += 1) {
    const durationHours = randInt(4, 16);
    if (totalHours + durationHours > targetHours) break;
    totalHours += durationHours;

    const project = projects[i % projects.length]!;
    const verb = TASK_VERBS[randInt(0, TASK_VERBS.length - 1)]!;
    const noun = TASK_NOUNS[randInt(0, TASK_NOUNS.length - 1)]!;
    // Each task gets enough headroom to actually fit before its deadline.
    // Floor on days-out so a 16h task always has at least ceil(16/8)=2 working
    // days to land. Spread across 6 weeks (42 calendar days).
    const minDaysOut = Math.max(3, Math.ceil(durationHours / 8) + 1);
    const daysOut = randInt(minDaysOut, 42);
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

    // 1–2 required skills per task; every skill is owned by ≥ 1 employee
    // (see the round-robin above) so MISSING_SKILLS won't dominate.
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
  console.log(
    `[seed] tasks: ${tasks.length} (${totalHours}h total, budget ${TASK_HOUR_BUDGET}h, target ${targetHours}h)`,
  );

  // ~20% of tasks get a dependency. To avoid cycles, depend only on earlier tasks
  // in the same project.
  let depsCreated = 0;
  for (const t of tasks) {
    if (rand() >= 0.2) continue;
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
