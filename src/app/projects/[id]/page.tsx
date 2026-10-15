import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "../../../lib/auth";
import { getOwnedProject } from "../../../lib/project-access";
import { db } from "../../../lib/db";
import { calculateCoverage } from "../../../lib/coverage";
import { CoverageCard } from "../../../components/CoverageCard";

type Props = { params: Promise<{ id: string }> };

async function Overview({ params }: Props) {
  await connection();
  const user = await requireUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id);
  if (!project) notFound();
  const itemSelect = { id: true, code: true, title: true } as const;
  const data = await db.project.findFirst({
    where: { id: project.id, owner_id: user.id },
    select: {
      requirements: { orderBy: [{ created_at: "asc" }, { id: "asc" }], select: itemSelect },
      user_stories: { orderBy: [{ created_at: "asc" }, { id: "asc" }], select: itemSelect },
      test_cases: { orderBy: [{ created_at: "asc" }, { id: "asc" }], select: itemSelect },
      links: { select: { source_type: true, source_id: true, target_type: true, target_id: true } },
    },
  });
  if (!data) notFound();
  const coverage = calculateCoverage({ requirements: data.requirements, userStories: data.user_stories, testCases: data.test_cases, links: data.links });
  const gaps = [
    { title: "Uncovered requirements", path: "requirements", items: coverage.requirementsWithoutTests, empty: "All requirements have test coverage." },
    { title: "Orphan tests", path: "tests", items: coverage.orphanTestCases, empty: "No orphan tests." },
    { title: "Stories without requirements", path: "stories", items: coverage.userStoriesWithoutRequirements, empty: "No stories without requirements." },
  ];

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
      <div className="mt-8"><CoverageCard coverage={coverage} /></div>
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {gaps.map((gap) => (
          <section key={gap.path} aria-label={gap.title} className="min-w-0">
            <h3 className="border-b pb-3 text-sm font-semibold">{gap.title} <span className="ml-1 text-muted-foreground">({gap.items.length})</span></h3>
            {gap.items.length === 0 ? <p className="py-4 text-sm text-muted-foreground">{gap.empty}</p> : (
              <ul className="divide-y">
                {gap.items.map((item) => <li key={item.id}><Link href={`/projects/${project.id}/${gap.path}?q=${encodeURIComponent(item.code)}`} className="block rounded py-3 focus-visible:outline-2 focus-visible:outline-ring hover:text-emerald-700"><span className="block font-mono text-xs text-muted-foreground">{item.code}</span><span className="mt-1 block break-words text-sm font-medium">{item.title}</span></Link></li>)}
              </ul>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}

export default function ProjectOverviewPage(props: Props) {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">Loading overview...</p>}><Overview {...props} /></Suspense>;
}
