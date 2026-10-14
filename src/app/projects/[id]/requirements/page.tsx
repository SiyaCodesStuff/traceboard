import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../../components/ui/table";
import { requireUser } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { getOwnedProject } from "../../../../lib/project-access";
import { getLinkedTestCounts } from "../../../../lib/requirement-links";
import { EntityType, Priority, RequirementStatus } from "../../../../lib/validators";
import { RequirementDialog, DeleteRequirementDialog } from "../../../../components/RequirementDialogs";

const priorityColors: Record<Priority, string> = {
  LOW: "bg-zinc-100 text-zinc-700", MEDIUM: "bg-sky-50 text-sky-800",
  HIGH: "bg-amber-50 text-amber-800", CRITICAL: "bg-rose-50 text-rose-800",
};
const statusColors: Record<RequirementStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700", APPROVED: "bg-emerald-50 text-emerald-800", TESTED: "bg-cyan-50 text-cyan-800",
};

async function Requirements({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await requireUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id);
  if (!project) notFound();
  const where = { project_id: project.id, project: { owner_id: user.id } };
  const [requirements, links, tests] = await Promise.all([
    db.requirement.findMany({ where, orderBy: [{ created_at: "asc" }, { id: "asc" }], select: { id: true, code: true, title: true, description: true, priority: true, status: true } }),
    db.link.findMany({ where: { ...where, OR: [
      { source_type: EntityType.REQUIREMENT, target_type: EntityType.TEST_CASE },
      { source_type: EntityType.TEST_CASE, target_type: EntityType.REQUIREMENT },
    ] }, select: { source_type: true, source_id: true, target_type: true, target_id: true } }),
    db.testCase.findMany({ where, select: { id: true } }),
  ]);
  const linkedTests = getLinkedTestCounts(links, tests.map((test) => test.id));
  return (
    <section aria-labelledby="requirements-heading">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><h2 id="requirements-heading" className="text-lg font-semibold">Requirements</h2><p className="mt-1 text-sm text-muted-foreground">{requirements.length} {requirements.length === 1 ? "requirement" : "requirements"}</p></div>
        <RequirementDialog projectId={project.id} />
      </div>
      <Table className="min-w-[680px]">
        <TableHeader><TableRow>
          <TableHead>Code</TableHead><TableHead>Title</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Linked tests</TableHead><TableHead><span className="sr-only">Actions</span></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {requirements.length === 0 ? <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No requirements yet.</TableCell></TableRow> : requirements.map((requirement) => (
            <TableRow key={requirement.id}>
              <TableCell className="font-mono text-xs">{requirement.code}</TableCell>
              <TableCell className="min-w-48 max-w-sm whitespace-normal"><span className="block break-words font-medium">{requirement.title}</span></TableCell>
              <TableCell><span className={`inline-block rounded px-2 py-1 text-xs font-medium ${priorityColors[requirement.priority]}`}>{requirement.priority.charAt(0) + requirement.priority.slice(1).toLowerCase()}</span></TableCell>
              <TableCell><span className={`inline-block rounded px-2 py-1 text-xs font-medium ${statusColors[requirement.status]}`}>{requirement.status.charAt(0) + requirement.status.slice(1).toLowerCase()}</span></TableCell>
              <TableCell className="text-right tabular-nums">{linkedTests.get(requirement.id) ?? 0}</TableCell>
              <TableCell><div className="flex justify-end gap-1"><RequirementDialog projectId={project.id} requirement={requirement} /><DeleteRequirementDialog projectId={project.id} requirement={requirement} /></div></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

export default function RequirementsPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">Loading requirements...</p>}><Requirements params={params} /></Suspense>;
}
