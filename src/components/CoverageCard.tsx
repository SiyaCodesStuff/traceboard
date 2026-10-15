import { Card, CardContent, CardHeader } from "../../components/ui/card";
import type { CoverageResult } from "../lib/coverage";

export function CoverageCard({ coverage }: { coverage: CoverageResult }) {
  const percentage = new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(coverage.coveragePercentage);
  return (
    <Card className="rounded-lg" aria-label="Requirement coverage">
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="font-semibold">Requirement coverage</h3>
          <span className="text-2xl font-semibold tabular-nums">{percentage}%</span>
        </div>
        <p className="text-sm text-muted-foreground">{coverage.coveredRequirementCount} of {coverage.totalRequirementCount} requirements covered</p>
      </CardHeader>
      <CardContent>
        <progress aria-label="Requirement coverage" max={100} value={coverage.coveragePercentage} className="block h-2 w-full overflow-hidden rounded bg-muted accent-emerald-600 [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-emerald-600 [&::-moz-progress-bar]:bg-emerald-600" />
        <dl className="mt-6 grid gap-5 sm:grid-cols-3">
          {[
            ["Uncovered requirements", coverage.requirementsWithoutTests.length],
            ["Orphan tests", coverage.orphanTestCases.length],
            ["Stories without requirements", coverage.userStoriesWithoutRequirements.length],
          ].map(([label, count]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{count}</dd></div>)}
        </dl>
      </CardContent>
    </Card>
  );
}
