import { describe, expect, it } from "vitest";
import { buildCoverageCsv, escapeCsvCell } from "../lib/csv";
import type { CoverageLink } from "../lib/coverage";

describe("CSV escaping", () => {
  it("quotes commas, doubles quotes, and preserves embedded newlines", () => {
    expect(escapeCsvCell('A, "quoted"\r\nline')).toBe('"A, ""quoted""\r\nline"');
    expect(escapeCsvCell("")).toBe('""');
  });
  it.each(["=SUM(A1)", "+1", "-1", "@SUM(A1)", "  =1", "\t=1", "\r=1", "\n=1", "\uFEFF=1"])("neutralizes formula cell %j", (value) => {
    expect(escapeCsvCell(value)).toBe(`"'${value}"`);
  });
  it("leaves normal content unchanged apart from CSV quoting", () => {
    expect(escapeCsvCell("REQ-001")).toBe('"REQ-001"');
    expect(escapeCsvCell("test@example.com")).toBe('"test@example.com"');
  });
});

describe("coverage CSV", () => {
  const requirements = [
    { id: "r1", code: "REQ-001", title: '=HYPERLINK("bad")', priority: "HIGH", status: "DRAFT" },
    { id: "r2", code: "REQ-002", title: "Gap, title\nnext line", priority: "LOW", status: "APPROVED" },
  ];
  const userStories = [{ id: "s1", code: "US-001" }];
  const testCases = [{ id: "t1", code: "TC-001" }, { id: "t2", code: "TC-002" }];
  const links: CoverageLink[] = [
    { source_type: "USER_STORY", source_id: "s1", target_type: "REQUIREMENT", target_id: "r1" },
    { source_type: "REQUIREMENT", source_id: "r1", target_type: "USER_STORY", target_id: "s1" },
    { source_type: "TEST_CASE", source_id: "t1", target_type: "USER_STORY", target_id: "s1" },
    { source_type: "REQUIREMENT", source_id: "r1", target_type: "TEST_CASE", target_id: "t1" },
    { source_type: "TEST_CASE", source_id: "t2", target_type: "REQUIREMENT", target_id: "r1" },
    { source_type: "REQUIREMENT", source_id: "r2", target_type: "TEST_CASE", target_id: "missing" },
  ];
  it("exports headers, unique undirected links, story coverage, and gaps", () => {
    const csv = buildCoverageCsv({ requirements, userStories, testCases, links });
    expect(csv).toBe([
      '"Requirement code","Title","Priority","Status","Linked story codes","Linked test codes","Coverage"',
      '"REQ-001","\'=HYPERLINK(""bad"")","HIGH","DRAFT","US-001","TC-001; TC-002","Covered"',
      '"REQ-002","Gap, title\nnext line","LOW","APPROVED","","","Gap"',
      "",
    ].join("\r\n"));
  });
  it("includes tests reached only through a story", () => {
    const csv = buildCoverageCsv({ requirements: [requirements[0]], userStories, testCases, links: links.slice(0, 3) });
    expect(csv).toContain('"US-001","TC-001","Covered"');
  });
  it("returns only the header for an empty project", () => {
    expect(buildCoverageCsv({ requirements: [], userStories: [], testCases: [], links: [] }).split("\r\n")).toHaveLength(2);
  });
});
