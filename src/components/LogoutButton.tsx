"use client";

import { useActionState, useEffect } from "react";
import { LoaderCircle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { logOut } from "../app/(auth)/actions";
import type { AuthState } from "../lib/validators";

export function LogoutButton() {
  const [state, action, pending] = useActionState<AuthState, FormData>(logOut, {});
  useEffect(() => {
    if (state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={action}>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
        {pending ? "Logging out..." : "Log out"}
      </Button>
      {state.message && <p role="alert" className="mt-2 text-sm text-destructive">{state.message}</p>}
    </form>
  );
}
