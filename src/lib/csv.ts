import { calculateTraceMatrix, type CoverageInput, type CoverageItem } from "./coverage";

type CodedItem = CoverageItem & { code: string };
type Requirement = CodedItem & { title: string; priority: string; status: string };

export function escapeCsvCell(value: string): string {
  // Spreadsheet apps may ignore whitespace before interpreting a formula.
  const safe = /^[\s\uFEFF]*[=+\-@]/u.test(value) || /^[\t\r\n]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Test codes include direct links and the same two-hop story paths as the matrix. */
export function buildCoverageCsv(input: CoverageInput<Requirement, CodedItem, CodedItem>): string {
  const matrix = calculateTraceMatrix({ ...input, links: input.links.map((link, index) => ({ ...link, id: String(index) })) });
  const storiesByRequirement = new Map<string, Set<string>>();
  for (const link of input.links) {
    const requirementId = link.source_type === "REQUIREMENT" && link.target_type === "USER_STORY" ? link.source_id
      : link.target_type === "REQUIREMENT" && link.source_type === "USER_STORY" ? link.target_id : null;
    if (requirementId === null) continue;
    const storyId = link.source_type === "USER_STORY" ? link.source_id : link.target_id;
    const ids = storiesByRequirement.get(requirementId) ?? new Set<string>();
    ids.add(storyId);
    storiesByRequirement.set(requirementId, ids);
  }
  const rows = [
    ["Requirement code", "Title", "Priority", "Status", "Linked story codes", "Linked test codes", "Coverage"],
    ...matrix.rows.map((row) => [
      row.requirement.code, row.requirement.title, row.requirement.priority, row.requirement.status,
      input.userStories.filter((story) => storiesByRequirement.get(row.requirement.id)?.has(story.id)).map((story) => story.code).join("; "),
      row.cells.filter((cell) => cell.covered).map((cell) => input.testCases.find((test) => test.id === cell.testCaseId)!.code).join("; "),
      row.isCovered ? "Covered" : "Gap",
    ]),
  ];
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n") + "\r\n";
}
