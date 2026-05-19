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
  'TypeScript',
  'Node.js',
  'PostgreSQL',
  'CSS',
  'Docker',
] as const;

// Hand-picked profiles so every skill PAIR has ≥ 1 employee owning both —
// gives greedy a real choice when rebalancing and avoids MISSING_SKILLS
// noise even for tasks that require two skills. Indexed by employee number
// (1-based). Each row covers a different role flavour.
const EMPLOYEE_SKILL_PROFILES: Record<number, readonly string[]> = {
  1: ['React', 'TypeScript', 'CSS', 'Node.js'],         // FE-lean full-stack
  2: ['Node.js', 'PostgreSQL', 'Docker', 'CSS'],        // BE w/ presentation polish
  3: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],  // canonical full-stack
  4: ['TypeScript', 'Node.js', 'Docker', 'React'],      // BE / devops w/ React
  5: ['React', 'CSS', 'PostgreSQL', 'Docker'],          // FE w/ infra exposure
};

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

  // Assign skills via hand-picked profiles (see EMPLOYEE_SKILL_PROFILES above).
  // Every skill is owned by ≥ 2 employees so the optimizer always has a choice
  // when rebalancing — perfect for the "skewed → balanced" demo.
  const skillByName = new Map(skills.map((s) => [s.name, s]));
  for (let i = 0; i < employees.length; i += 1) {
    const emp = employees[i]!;
    const profile = EMPLOYEE_SKILL_PROFILES[i + 1] ?? [];
    for (const skillName of profile) {
      const skill = skillByName.get(skillName);
      if (!skill) continue;
      await prisma.userSkill.create({
        data: { userId: emp.id, skillId: skill.id, level: randInt(3, 5) },
      });
    }
  }
  console.log('[seed] user skills assigned (every skill has ≥ 2 owners)');

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

  // ===== Skewed starting state ==========================================
  // For the demo, pre-create OPTIMIZER-source UNLOCKED assignments piling
  // every task onto Employee 1. plannedStart/plannedEnd are chosen so the
  // workload heatmap shows Employee 1 deeply over capacity while the other
  // four employees sit at zero hours.
  //
  // Because every row has source=OPTIMIZER and lockedByManager=false, the
  // next `Re-optimize everything` run (replaceExisting=true) is free to wipe
  // them and redistribute work cleanly.
  const employee1 = employees[0]!;
  // Build dependency adjacency for the bias step too — pre-assignments still
  // need plannedStart >= dep.plannedEnd so the rows are self-consistent.
  const deps = await prisma.taskDependency.findMany({
    where: { task: { project: { organizationId: org.id } } },
    select: { taskId: true, dependsOnTaskId: true },
  });
  const depsByTask = new Map<string, string[]>();
  for (const d of deps) {
    if (!depsByTask.has(d.taskId)) depsByTask.set(d.taskId, []);
    depsByTask.get(d.taskId)!.push(d.dependsOnTaskId);
  }
  // Walk tasks in topological order, schedule each one starting the day after
  // its latest dep ends. Days advance sequentially so we get a visible spike.
  // Sort: tasks with no deps first, then by createdIdx.
  const orderedTasks = [...tasks].sort((a, b) => {
    const aDeps = depsByTask.get(a.id)?.length ?? 0;
    const bDeps = depsByTask.get(b.id)?.length ?? 0;
    if (aDeps !== bDeps) return aDeps - bDeps;
    return a.createdIdx - b.createdIdx;
  });
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const taskDurations = new Map<string, number>();
  for (const t of tasks) {
    const row = await prisma.task.findUnique({ where: { id: t.id }, select: { durationHours: true } });
    taskDurations.set(t.id, row?.durationHours ?? 8);
  }
  // Cursor = next available date for Employee 1.
  let cursor = new Date(now);
  cursor.setUTCHours(0, 0, 0, 0);
  const plannedEnd = new Map<string, Date>();
  let biasedAssignments = 0;
  for (const t of orderedTasks) {
    const hours = taskDurations.get(t.id) ?? 8;
    // earliestStart respects already-placed dependencies even within the bias.
    let earliest = new Date(cursor);
    for (const depId of depsByTask.get(t.id) ?? []) {
      const depEnd = plannedEnd.get(depId);
      if (depEnd) {
        const next = new Date(depEnd);
        next.setUTCDate(next.getUTCDate() + 1);
        if (next > earliest) earliest = next;
      }
    }
    // span = ceil(hours / 8) working days (Mon-Fri only)
    const spanDays = Math.max(1, Math.ceil(hours / 8));
    const start = new Date(earliest);
    // Skip weekends for the start day.
    while (start.getUTCDay() === 0 || start.getUTCDay() === 6) {
      start.setUTCDate(start.getUTCDate() + 1);
    }
    const end = new Date(start);
    let placed = 0;
    while (placed < spanDays - 1) {
      end.setUTCDate(end.getUTCDate() + 1);
      if (end.getUTCDay() >= 1 && end.getUTCDay() <= 5) placed += 1;
    }
    await prisma.assignment.create({
      data: {
        taskId: t.id,
        userId: employee1.id,
        plannedHours: hours,
        plannedStart: start,
        plannedEnd: end,
        source: 'OPTIMIZER',
        lockedByManager: false,
      },
    });
    plannedEnd.set(t.id, end);
    biasedAssignments += 1;
    // Advance cursor: leave the prior task's end date in place; next task
    // starts the same day at the earliest, so several short tasks pile up.
    cursor = start;
  }
  console.log(
    `[seed] skewed starting state: piled ${biasedAssignments} tasks on ${employee1.fullName} (source=OPTIMIZER, unlocked)`,
  );

  console.log('\n[seed] done.');
  console.log('Credentials (password: "password"):');
  console.log(`  admin:     ${admin.email}`);
  managers.forEach((m) => console.log(`  manager:   ${m.email}`));
  console.log(`  employees: emp1@demo.local ... emp${employees.length}@demo.local`);
  console.log('\nDemo flow:');
  console.log(`  1. Open /manager/workload — Employee 1 is saturated, others at 0h.`);
  console.log(`  2. Open /manager/optimizer — pick "Re-optimize everything" + Run.`);
  console.log(`  3. Back to /manager/workload — every employee now ~${Math.round(totalHours / 5)}h, no day > 8h.`);
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
