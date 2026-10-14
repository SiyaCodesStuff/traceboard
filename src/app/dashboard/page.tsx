import { Suspense } from "react";
import { connection } from "next/server";
import { Network } from "lucide-react";
import { requireUser } from "../../lib/auth";
import { LogoutButton } from "../../components/LogoutButton";

async function Dashboard() {
  await connection();
  const user = await requireUser();
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-2 text-lg font-semibold"><Network className="size-5 text-emerald-700" aria-hidden="true" />Traceboard</div>
        <LogoutButton />
      </header>
      <h1 className="mt-8 text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 break-all text-sm text-muted-foreground">Signed in as {user.email}</p>
    </main>
  );
}

export default function DashboardPage() {
  return <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading dashboard...</p>}><Dashboard /></Suspense>;
}
