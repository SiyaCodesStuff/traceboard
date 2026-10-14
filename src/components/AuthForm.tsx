"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, Network } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { logIn, signUp } from "../app/(auth)/actions";
import type { AuthState } from "../lib/validators";

export function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const signup = mode === "signup";
  const [state, action, pending] = useActionState<AuthState, FormData>(signup ? signUp : logIn, {});

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-lg font-semibold">
          <Network className="size-5 text-emerald-700" aria-hidden="true" />Traceboard
        </Link>
        <h1 className="text-2xl font-semibold">{signup ? "Create your account" : "Log in"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{signup ? "Keep your project work connected." : "Welcome back to your projects."}</p>
        {state.status === "confirmation" ? (
          <div role="status" className="mt-6 border-l-2 border-emerald-600 bg-emerald-50 p-4 text-sm text-emerald-950">
            <CheckCircle2 className="mb-2 size-5" aria-hidden="true" />
            <p className="font-medium">Confirm your email</p>
            <p className="mt-1 leading-6">{state.message}</p>
          </div>
        ) : (
          <form action={action} noValidate className="mt-7 space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">Email</label>
              <Input id="email" name="email" type="email" autoComplete="email" required
                defaultValue={state.email} disabled={pending} className="h-10"
                aria-invalid={Boolean(state.fieldErrors?.email)}
                aria-describedby={state.fieldErrors?.email ? "email-error" : undefined} />
              {state.fieldErrors?.email && <p id="email-error" className="mt-2 text-sm text-destructive">{state.fieldErrors.email[0]}</p>}
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label>
              <Input id="password" name="password" type="password" minLength={8} required
                autoComplete={signup ? "new-password" : "current-password"} disabled={pending} className="h-10"
                aria-invalid={Boolean(state.fieldErrors?.password)}
                aria-describedby={state.fieldErrors?.password ? "password-error" : undefined} />
              {state.fieldErrors?.password && <p id="password-error" className="mt-2 text-sm text-destructive">{state.fieldErrors.password[0]}</p>}
            </div>
            {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
            <Button type="submit" disabled={pending} className="h-10 w-full gap-2">
              {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
              {pending ? "Please wait..." : signup ? "Create account" : "Log in"}
            </Button>
          </form>
        )}
        <p className="mt-6 text-sm text-muted-foreground">
          {signup ? "Already have an account? " : "New to Traceboard? "}
          <Link href={signup ? "/login" : "/signup"} className="font-medium text-foreground underline underline-offset-4">
            {signup ? "Log in" : "Create an account"}
          </Link>
        </p>
      </div>
    </main>
  );
}
