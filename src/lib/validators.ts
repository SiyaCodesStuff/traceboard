import { z } from "zod";

export const authSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must contain at least 8 characters."),
});

export type AuthState = {
  status?: "error" | "confirmation";
  message?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
  email?: string;
};

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Enter a project name.").max(120, "Use at most 120 characters."),
  description: z.string().trim().max(2000, "Use at most 2,000 characters."),
});

export const projectIdSchema = z.string().uuid("Invalid project ID.");

export type ProjectActionState = {
  status?: "error" | "success";
  message?: string;
  fieldErrors?: { name?: string[]; description?: string[] };
  values?: { name: string; description: string };
};
