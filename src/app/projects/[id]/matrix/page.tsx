import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireUser } from "../../../../lib/auth";
import { getOwnedProject } from "../../../../lib/project-access";
import { db } from "../../../../lib/db";
import { calculateTraceMatrix } from "../../../../lib/coverage";
import { TraceMatrix } from "../../../../components/TraceMatrix";

type Props = { params: Promise<{ id: string }> };

async function Matrix({ params }: Props) {
  await connection();
  const user = await requireUser();
  const { id } = await params;
  // Query 1 is shared with the layout through getOwnedProject's request cache.
  const project = await getOwnedProject(id, user.id);
  if (!project) notFound();
  // Query 2 loads the complete graph with nested Prisma selections, not per-cell reads.
  const data = await db.project.findFirst({
    where: { id: project.id, owner_id: user.id },
    select: {
      requirements: { orderBy: [{ created_at: "asc" }, { id: "asc" }], select: { id: true, code: true, title: true } },
      user_stories: { select: { id: true } },
      test_cases: { orderBy: [{ created_at: "asc" }, { id: "asc" }], select: { id: true, code: true, title: true } },
      links: { select: { id: true, source_type: true, source_id: true, target_type: true, target_id: true } },
    },
  });
  if (!data) notFound();
  const matrix = calculateTraceMatrix({ requirements: data.requirements, userStories: data.user_stories, testCases: data.test_cases, links: data.links });
  return <TraceMatrix projectId={project.id} matrix={matrix} />;
}

export default function MatrixPage(props: Props) {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">Loading matrix...</p>}><Matrix {...props} /></Suspense>;
}
