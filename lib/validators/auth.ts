import { z } from "zod";

export const RegisterSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(1).max(120),
    password: z.string().min(8),
  })
  .strict();

export type RegisterInput = z.infer<typeof RegisterSchema>;

