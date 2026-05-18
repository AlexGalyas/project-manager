import { z } from 'zod';

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const OptimizerRunInputSchema = z.object({
  projectIds: z.array(z.string()).optional(),
  replaceExisting: z.boolean().default(false),
  weights: z
    .object({
      alpha: z.number().nonnegative().default(1.0),
      beta: z.number().nonnegative().default(2.0),
      gamma: z.number().nonnegative().default(0.5),
    })
    .optional(),
});
export type OptimizerRunInput = z.infer<typeof OptimizerRunInputSchema>;

const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'must be an ISO date string' });

export const ProjectCreateInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  priority: z.number().int().min(1).max(5).default(3),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
});
export type ProjectCreateInput = z.infer<typeof ProjectCreateInputSchema>;

export const ProjectUpdateInputSchema = ProjectCreateInputSchema.partial();
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateInputSchema>;

export const TaskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);

export const TaskCreateInputSchema = z.object({
  name: z.string().min(1).max(180),
  durationHours: z.number().positive().max(1000),
  deadline: isoDate.optional(),
  priority: z.number().int().min(1).max(5).default(3),
  status: TaskStatusSchema.default('TODO'),
  skillIds: z.array(z.string()).max(20).default([]),
  dependsOnIds: z.array(z.string()).max(20).default([]),
});
export type TaskCreateInput = z.infer<typeof TaskCreateInputSchema>;

export const TaskUpdateInputSchema = z
  .object({
    name: z.string().min(1).max(180),
    durationHours: z.number().positive().max(1000),
    deadline: isoDate.nullable(),
    priority: z.number().int().min(1).max(5),
    status: TaskStatusSchema,
    skillIds: z.array(z.string()).max(20),
    dependsOnIds: z.array(z.string()).max(20),
  })
  .partial();
export type TaskUpdateInput = z.infer<typeof TaskUpdateInputSchema>;

export const AssignmentListQuerySchema = z.object({
  userId: z.string().optional(),
  projectId: z.string().optional(),
});
export type AssignmentListQuery = z.infer<typeof AssignmentListQuerySchema>;

export const RoleSchema = z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']);

export const UserCreateInputSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(2).max(100),
  password: z.string().min(8).max(72),
  role: RoleSchema,
  maxHoursPerWeek: z.number().int().min(1).max(80).default(40),
  skillIds: z.array(z.string()).default([]),
});
export type UserCreateInput = z.infer<typeof UserCreateInputSchema>;

export const UserUpdateInputSchema = z
  .object({
    email: z.string().email(),
    fullName: z.string().trim().min(2).max(100),
    role: RoleSchema,
    maxHoursPerWeek: z.number().int().min(1).max(80),
    skillIds: z.array(z.string()).max(50),
  })
  .partial();
export type UserUpdateInput = z.infer<typeof UserUpdateInputSchema>;

export const UserPasswordChangeInputSchema = z.object({
  password: z.string().min(8).max(72),
});
export type UserPasswordChangeInput = z.infer<typeof UserPasswordChangeInputSchema>;

export const UserSetSkillsInputSchema = z.object({
  skillIds: z.array(z.string()).max(50),
});
export type UserSetSkillsInput = z.infer<typeof UserSetSkillsInputSchema>;

export const SkillCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(50),
});
export type SkillCreateInput = z.infer<typeof SkillCreateInputSchema>;

export const SkillUpdateInputSchema = SkillCreateInputSchema;
export type SkillUpdateInput = z.infer<typeof SkillUpdateInputSchema>;
