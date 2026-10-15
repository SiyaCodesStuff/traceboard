"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { createLink, deleteLink } from "../app/projects/[id]/links/actions";
import type { CoverageItem, TraceMatrixCell, TraceMatrixModel } from "../lib/coverage";

type MatrixItem = CoverageItem & { code: string; title: string };
type Props = { projectId: string; matrix: TraceMatrixModel<MatrixItem, CoverageItem, MatrixItem> };

export function TraceMatrix({ projectId, matrix }: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [pendingCell, setPendingCell] = useState("");
  const { coverage, rows, testCases } = matrix;

  function toggle(requirement: MatrixItem, cell: TraceMatrixCell) {
    if (busy || (cell.viaStory && cell.directLinkIds.length === 0)) return;
    setPendingCell(`${requirement.id}:${cell.testCaseId}`);
    startTransition(async () => {
      try {
        if (cell.directLinkIds.length) {
          for (const id of cell.directLinkIds) {
            const form = new FormData(); form.set("project_id", projectId); form.set("id", id);
            const result = await deleteLink({}, form);
            if (result.status !== "success") { toast.error(result.message); return; }
          }
          toast.success("Direct link removed.");
        } else {
          const form = new FormData();
          form.set("project_id", projectId); form.set("source_type", "REQUIREMENT"); form.set("source_id", requirement.id);
          form.set("target_type", "TEST_CASE"); form.set("target_id", cell.testCaseId);
          const result = await createLink({}, form);
          if (result.status === "success") toast.success(result.message);
          else toast.error(result.message);
        }
      } catch { toast.error("Unable to update the link. Please try again."); }
      finally { router.refresh(); }
    });
  }

  return (
    <section aria-labelledby="matrix-heading">
      <h2 id="matrix-heading" className="text-lg font-semibold">Traceability matrix</h2>
      <dl className="my-6 grid grid-cols-2 gap-5 border-y py-5 sm:grid-cols-4">
        {[
          ["Coverage", `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(coverage.coveragePercentage)}%`],
          ["Requirements covered", `${coverage.coveredRequirementCount} / ${coverage.totalRequirementCount}`],
          ["Orphan tests", coverage.orphanTestCases.length],
          ["Unassigned stories", coverage.userStoriesWithoutRequirements.length],
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd></div>)}
      </dl>
      {rows.length === 0 ? <p className="py-8 text-sm text-muted-foreground">No requirements yet.</p> : (
        <>
          {testCases.length === 0 && <p className="mb-4 text-sm text-muted-foreground">No test cases yet.</p>}
          <div role="region" aria-label="Matrix grid" tabIndex={0} className="relative isolate max-h-[65vh] overflow-auto overscroll-contain rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <table className="table-fixed border-separate border-spacing-0 text-sm" style={{ width: 256 + testCases.length * 144, minWidth: "100%" }}>
              <caption className="sr-only">Requirements by test cases</caption>
              <colgroup><col style={{ width: 256 }} />{testCases.map((test) => <col key={test.id} style={{ width: 144 }} />)}</colgroup>
              <thead><tr>
                <th scope="col" className="sticky top-0 left-0 z-30 border-r border-b bg-muted p-4 text-left font-medium">Requirement</th>
                {testCases.map((test) => <th key={test.id} scope="col" title={`${test.code}: ${test.title}`} className="sticky top-0 z-20 h-24 border-r border-b bg-muted px-3 py-4 text-center last:border-r-0">
                  <span className="block font-mono text-xs font-medium">{test.code}</span><span className="mt-1 line-clamp-2 break-words text-xs font-normal text-muted-foreground">{test.title}</span>
                </th>)}
              </tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.requirement.id} data-uncovered={!row.isCovered}>
                  <th scope="row" className={`sticky left-0 z-10 border-r border-b px-4 py-3 text-left font-normal ${row.isCovered ? "bg-background" : "bg-rose-50 text-rose-950"}`}>
                    <span className="flex items-center gap-2 font-mono text-xs">{row.requirement.code}{!row.isCovered && <TriangleAlert className="size-3.5 text-rose-600" aria-label="No test coverage" />}</span>
                    <span className="mt-1 block break-words text-sm font-medium">{row.requirement.title}</span>
                  </th>
                  {row.cells.map((cell, index) => {
                    const test = testCases[index];
                    const indirectOnly = cell.viaStory && !cell.directLinkIds.length;
                    const label = indirectOnly ? `${row.requirement.code} covered by ${test.code} via story`
                      : cell.directLinkIds.length ? `Unlink ${row.requirement.code} from ${test.code}` : `Link ${row.requirement.code} to ${test.code}`;
                    const title = indirectOnly ? "Covered via a story" : cell.viaStory ? "Remove direct link; story coverage remains" : label;
                    return <td key={cell.testCaseId} className={`border-r border-b p-0 last:border-r-0 ${row.isCovered ? "bg-background" : "bg-rose-50"}`}>
                      <button type="button" aria-label={label} aria-pressed={cell.covered} title={title} disabled={busy || indirectOnly}
                        onClick={() => toggle(row.requirement, cell)} className="group flex h-20 w-full items-center justify-center outline-none enabled:hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default">
                        {busy && pendingCell === `${row.requirement.id}:${cell.testCaseId}` ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                          : cell.covered ? <Check className={`size-5 ${indirectOnly ? "text-emerald-600" : "text-emerald-800"}`} aria-hidden="true" />
                            : <Plus className="size-4 text-muted-foreground opacity-30 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />}
                      </button>
                    </td>;
                  })}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
