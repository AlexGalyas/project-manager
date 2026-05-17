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
