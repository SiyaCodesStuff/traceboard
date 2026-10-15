import { describe, expect, it } from "vitest";
import { calculateCoverage, calculateTraceMatrix, type MatrixLink } from "../lib/coverage";

const requirements = [{ id: "r1", code: "REQ-001", title: "First" }, { id: "r2", code: "REQ-002", title: "Second" }];
const userStories = [{ id: "s1" }];
const testCases = [{ id: "t1", code: "TC-001", title: "One" }, { id: "t2", code: "TC-002", title: "Two" }];
const input = (links: MatrixLink[] = []) => ({ requirements, userStories, testCases, links });
const direct: MatrixLink = { id: "l1", source_type: "REQUIREMENT", source_id: "r1", target_type: "TEST_CASE", target_id: "t1" };
const indirect: MatrixLink[] = [
  { id: "l2", source_type: "USER_STORY", source_id: "s1", target_type: "REQUIREMENT", target_id: "r1" },
  { id: "l3", source_type: "TEST_CASE", source_id: "t2", target_type: "USER_STORY", target_id: "s1" },
];

describe("trace matrix calculation", () => {
  it("builds one cell per requirement-test pair and marks uncovered rows", () => {
    const matrix = calculateTraceMatrix(input());
    expect(matrix.rows).toHaveLength(2);
    expect(matrix.testCases).toEqual(testCases);
    for (const row of matrix.rows) {
      expect(row.isCovered).toBe(false);
      expect(row.coveredTestCount).toBe(0);
      expect(row.cells).toEqual(testCases.map((test) => ({ testCaseId: test.id, covered: false, viaStory: false, directLinkIds: [] })));
    }
  });
  it("uses the shared coverage rules for summary and cells", () => {
    const data = input([direct, ...indirect]);
    const matrix = calculateTraceMatrix(data);
    expect(matrix.coverage).toEqual(calculateCoverage(data));
    expect(matrix.coverage.coveragePercentage).toBe(50);
    expect(matrix.rows[0]).toMatchObject({ isCovered: true, coveredTestCount: 2 });
    expect(matrix.rows[1].isCovered).toBe(false);
    expect(matrix.rows[0].cells).toEqual([
      { testCaseId: "t1", covered: true, viaStory: false, directLinkIds: ["l1"] },
      { testCaseId: "t2", covered: true, viaStory: true, directLinkIds: [] },
    ]);
  });
  it("retains reversed direct link IDs for removal", () => {
    const reversed: MatrixLink = { id: "reverse", source_type: "TEST_CASE", source_id: "t1", target_type: "REQUIREMENT", target_id: "r1" };
    expect(calculateTraceMatrix(input([reversed])).rows[0].cells[0]).toMatchObject({ covered: true, directLinkIds: ["reverse"] });
  });
  it("retains every legacy duplicate ID once without inflating coverage", () => {
    const reversed: MatrixLink = { id: "reverse", source_type: "TEST_CASE", source_id: "t1", target_type: "REQUIREMENT", target_id: "r1" };
    const matrix = calculateTraceMatrix(input([direct, direct, reversed]));
    expect(matrix.rows[0].cells[0].directLinkIds).toEqual(["l1", "reverse"]);
    expect(matrix.rows[0].coveredTestCount).toBe(1);
  });
  it("keeps indirect coverage after a direct link is removed", () => {
    const links = [...indirect, { ...direct, target_id: "t2" }];
    expect(calculateTraceMatrix(input(links)).rows[0].cells[1]).toMatchObject({ covered: true, viaStory: true, directLinkIds: ["l1"] });
    expect(calculateTraceMatrix(input(indirect)).rows[0].cells[1]).toMatchObject({ covered: true, viaStory: true, directLinkIds: [] });
  });
  it("ignores dangling endpoints and avoids phantom columns", () => {
    const matrix = calculateTraceMatrix(input([{ ...direct, target_id: "missing" }]));
    expect(matrix.testCases).toHaveLength(2);
    expect(matrix.rows[0].cells.every((cell) => !cell.covered)).toBe(true);
    expect(matrix.coverage.coveragePercentage).toBe(0);
  });
  it("handles no requirements and no tests", () => {
    expect(calculateTraceMatrix({ ...input(), requirements: [] }).rows).toEqual([]);
    const matrix = calculateTraceMatrix({ ...input(), testCases: [] });
    expect(matrix.coverage.coveragePercentage).toBe(0);
    expect(matrix.rows.every((row) => !row.isCovered && row.cells.length === 0)).toBe(true);
  });
  it("preserves order and metadata without mutating frozen inputs", () => {
    const data = {
      requirements: Object.freeze(requirements.map((item) => Object.freeze({ ...item }))),
      userStories: Object.freeze(userStories), testCases: Object.freeze(testCases), links: Object.freeze([Object.freeze(direct)]),
    };
    const before = JSON.stringify(data);
    const matrix = calculateTraceMatrix(data);
    expect(matrix.rows[0].requirement).toBe(data.requirements[0]);
    expect(matrix.testCases[1]).toBe(data.testCases[1]);
    expect(JSON.stringify(data)).toBe(before);
  });
});
