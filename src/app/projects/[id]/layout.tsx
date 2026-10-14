import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireUser } from "../../../lib/auth";
import { getOwnedProject } from "../../../lib/project-access";
import { ProjectTabs } from "../../../components/ProjectTabs";
import { LogoutButton } from "../../../components/LogoutButton";

type Props = { params: Promise<{ id: string }>; children: ReactNode };

async function ProjectShell({ params, children }: Props) {
  await connection();
  const user = await requireUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id);
  if (!project) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />Your projects
        </Link>
        <LogoutButton />
      </div>
      <header className="mt-8">
        <h1 className="break-words text-2xl font-semibold">{project.name}</h1>
        <ProjectTabs projectId={project.id} />
      </header>
      <div className="py-8">{children}</div>
    </main>
  );
}

export default function ProjectLayout(props: Props) {
  return <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading project...</p>}><ProjectShell {...props} /></Suspense>;
}
