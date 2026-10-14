import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ClipboardCheck, FileText, FolderOpen, Network, ScrollText } from "lucide-react";
import { requireUser } from "../../lib/auth";
import { db } from "../../lib/db";
import { LogoutButton } from "../../components/LogoutButton";
import { NewProjectDialog } from "../../components/NewProjectDialog";
import { DeleteProjectDialog } from "../../components/DeleteProjectDialog";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";

async function Dashboard() {
  await connection();
  const user = await requireUser();
  const projects = await db.project.findMany({
    where: { owner_id: user.id },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    select: {
      id: true, name: true, description: true, created_at: true,
      _count: { select: { requirements: true, user_stories: true, test_cases: true } },
    },
  });
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-2 text-lg font-semibold"><Network className="size-5 text-emerald-700" aria-hidden="true" />Traceboard</div>
        <LogoutButton />
      </header>
      <div className="my-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Your projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">{projects.length} {projects.length === 1 ? "project" : "projects"}</p>
        </div>
        <NewProjectDialog />
      </div>
      {projects.length === 0 ? (
        <section className="flex flex-col items-center border-y py-16 text-center">
          <FolderOpen className="mb-4 size-9 text-emerald-700" aria-hidden="true" />
          <h2 className="text-lg font-medium">No projects yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Create your first project to bring requirements, stories, and tests together.</p>
        </section>
      ) : (
        <section aria-label="Projects" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="min-w-0 rounded-lg">
              <CardHeader>
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <h2 className="min-w-0 break-words pt-1 text-base font-semibold"><Link href={`/projects/${project.id}`} className="hover:underline">{project.name}</Link></h2>
                  <DeleteProjectDialog projectId={project.id} name={project.name} />
                </div>
                <p className="min-h-10 break-words text-sm text-muted-foreground">{project.description || "No description"}</p>
              </CardHeader>
              <CardContent className="mt-auto">
                <dl className="space-y-2 border-t pt-4 text-sm">
                  {[
                    { label: "Requirements", count: project._count.requirements, Icon: FileText },
                    { label: "Stories", count: project._count.user_stories, Icon: ScrollText },
                    { label: "Tests", count: project._count.test_cases, Icon: ClipboardCheck },
                  ].map(({ label, count, Icon }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <dt className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" aria-hidden="true" />{label}</dt>
                      <dd className="font-medium tabular-nums">{count}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Created <time dateTime={project.created_at.toISOString()}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(project.created_at)}</time></p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}

export default function DashboardPage() {
  return <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading dashboard...</p>}><Dashboard /></Suspense>;
}
