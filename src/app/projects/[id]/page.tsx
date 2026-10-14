import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireUser } from "../../../lib/auth";
import { getOwnedProject } from "../../../lib/project-access";

type Props = { params: Promise<{ id: string }> };

async function Overview({ params }: Props) {
  await connection();
  const user = await requireUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id);
  if (!project) notFound();

  return (
    <section aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="text-lg font-semibold">Overview</h2>
      <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{project.description || "No description"}</p>
      <dl className="mt-8 grid grid-cols-2 gap-6 border-y py-6 sm:grid-cols-4">
        {[
          ["Requirements", project._count.requirements], ["Stories", project._count.user_stories],
          ["Tests", project._count.test_cases], ["Links", project._count.links],
        ].map(([label, count]) => (
          <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{count}</dd></div>
        ))}
      </dl>
    </section>
  );
}

export default function ProjectOverviewPage(props: Props) {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">Loading overview...</p>}><Overview {...props} /></Suspense>;
}
