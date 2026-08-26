import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;

export const authPasswordSchema = z.string().min(1).max(128);

export const signInSchema = z.object({
  email: z.string().trim().email(),
  password: authPasswordSchema,
});

export const signUpSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  email: z.string().trim().email(),
  password: authPasswordSchema.min(PASSWORD_MIN_LENGTH),
});
