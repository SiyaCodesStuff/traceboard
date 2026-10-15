import { getCurrentUser } from "../../../lib/auth";
import { getOwnedProject } from "../../../lib/project-access";
import { db } from "../../../lib/db";
import { projectIdSchema } from "../../../lib/validators";
import { buildCoverageCsv } from "../../../lib/csv";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const parsed = projectIdSchema.safeParse(new URL(request.url).searchParams.get("projectId"));
  if (!parsed.success) return Response.json({ error: "A valid projectId is required." }, { status: 400 });
  const project = await getOwnedProject(parsed.data, user.id);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const orderBy = [{ created_at: "asc" as const }, { id: "asc" as const }];
  const data = await db.project.findFirst({
    where: { id: project.id, owner_id: user.id },
    select: {
      requirements: { orderBy, select: { id: true, code: true, title: true, priority: true, status: true } },
      user_stories: { orderBy, select: { id: true, code: true } },
      test_cases: { orderBy, select: { id: true, code: true } },
      links: { select: { source_type: true, source_id: true, target_type: true, target_id: true } },
    },
  });
  if (!data) return Response.json({ error: "Project not found." }, { status: 404 });
  return new Response(buildCoverageCsv({ requirements: data.requirements, userStories: data.user_stories, testCases: data.test_cases, links: data.links }), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="traceability-${project.id}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
