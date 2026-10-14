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
