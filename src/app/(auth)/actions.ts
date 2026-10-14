"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { authSchema, type AuthState } from "../../lib/validators";

function validate(formData: FormData) {
  return authSchema.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });
}

function authErrorMessage(code: string | undefined, mode: "signup" | "login") {
  switch (code) {
    case "email_not_confirmed":
      return "Confirm your email using the link in your inbox, then log in.";
    case "over_email_send_rate_limit":
      return "The confirmation email limit has been reached. Please wait before trying again.";
    case "over_request_rate_limit":
      return "Too many authentication attempts. Please wait a few minutes and try again.";
    case "email_address_not_authorized":
      return "This project's email provider cannot send confirmation emails to this address. Contact the administrator to configure a custom SMTP provider.";
    case "email_address_invalid":
      return "Use a valid email address. Example and test domains are not supported.";
    case "signup_disabled":
      return "New account registration is currently disabled.";
    case "email_provider_disabled":
      return "Email and password authentication is currently disabled.";
    case "weak_password":
      return "This password does not meet the project's password rules. Choose a stronger password.";
    default:
      return mode === "login"
        ? "Unable to log in. Check your email and password and try again."
        : "Unable to create your account. Please try again.";
  }
}

async function authenticate(formData: FormData, mode: "signup" | "login"): Promise<AuthState> {
  const parsed = validate(formData);
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";
  if (!parsed.success) {
    return {
      status: "error", message: "Check the highlighted fields.", email,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = mode === "signup"
      ? await supabase.auth.signUp(parsed.data)
      : await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      console.error("[Supabase Auth] Authentication failed", {
        operation: mode, code: error.code ?? "unknown", status: error.status,
      });
      const message = authErrorMessage(error.code, mode);
      return {
        status: "error", message, email: parsed.data.email,
        ...(error.code === "weak_password" ? { fieldErrors: { password: [message] } } : {}),
      };
    }

    if (mode === "signup" && !data.session) {
      return {
        status: "confirmation", email: parsed.data.email,
        message: "Check your inbox for a confirmation email. Follow the link to confirm your address, then log in.",
      };
    }
    if (!data.session) {
      return { status: "error", message: "Unable to log in. Please try again.", email: parsed.data.email };
    }
  } catch (error) {
    console.error("[Supabase Auth] Authentication unavailable", {
      operation: mode, errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return { status: "error", message: "Authentication is unavailable. Please try again.", email: parsed.data.email };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  return authenticate(formData, "signup");
}

export async function logIn(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  return authenticate(formData, "login");
}

export async function logOut(): Promise<AuthState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { status: "error", message: "Unable to log out. Please try again." };
  } catch {
    return { status: "error", message: "Unable to log out. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
