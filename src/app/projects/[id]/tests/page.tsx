import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../../components/ui/table";
import { requireUser } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { getOwnedProject } from "../../../../lib/project-access";
import { TestCaseStatus } from "../../../../lib/validators";
import { TestCaseDialog, DeleteTestCaseDialog } from "../../../../components/TestCaseDialogs";

const statusStyles: Record<TestCaseStatus, { label: string; color: string }> = {
  NOT_RUN: { label: "Not run", color: "bg-zinc-100 text-zinc-700" },
  PASSED: { label: "Passed", color: "bg-emerald-50 text-emerald-800" },
  FAILED: { label: "Failed", color: "bg-rose-50 text-rose-800" },
};

async function Tests({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await requireUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id);
  if (!project) notFound();
  const tests = await db.testCase.findMany({
    where: { project_id: project.id, project: { owner_id: user.id } },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: { id: true, code: true, title: true, steps: true, expected_result: true, status: true },
  });
  return (
    <section aria-labelledby="tests-heading">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><h2 id="tests-heading" className="text-lg font-semibold">Tests</h2><p className="mt-1 text-sm text-muted-foreground">{tests.length} {tests.length === 1 ? "test case" : "test cases"}</p></div>
        <TestCaseDialog projectId={project.id} />
      </div>
      <Table className="min-w-[900px] table-fixed">
        <TableHeader><TableRow><TableHead className="w-24">Code</TableHead><TableHead className="w-44">Title</TableHead><TableHead>Steps</TableHead><TableHead>Expected result</TableHead><TableHead className="w-24">Status</TableHead><TableHead className="w-24"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
        <TableBody>
          {tests.length === 0 ? <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No test cases yet.</TableCell></TableRow> : tests.map((testCase) => (
            <TableRow key={testCase.id}>
              <TableCell className="font-mono text-xs">{testCase.code}</TableCell>
              <TableCell className="whitespace-normal"><span className="block break-words font-medium">{testCase.title}</span></TableCell>
              <TableCell><div className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words leading-6">{testCase.steps}</div></TableCell>
              <TableCell><div className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words leading-6">{testCase.expected_result}</div></TableCell>
              <TableCell><span className={`inline-block rounded px-2 py-1 text-xs font-medium ${statusStyles[testCase.status].color}`}>{statusStyles[testCase.status].label}</span></TableCell>
              <TableCell><div className="flex justify-end gap-1"><TestCaseDialog projectId={project.id} testCase={testCase} /><DeleteTestCaseDialog projectId={project.id} testCase={testCase} /></div></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

export default function TestsPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">Loading test cases...</p>}><Tests params={params} /></Suspense>;
}
