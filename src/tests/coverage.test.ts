import { describe, expect, it } from "vitest";
import { calculateCoverage, calculateCoveragePercentage } from "../lib/coverage";
import type { CoverageEntityType, CoverageLink } from "../lib/coverage";

const requirements = [{ id: "r1", title: "First" }, { id: "r2", title: "Second" }, { id: "r3", title: "Third" }];
const userStories = [{ id: "s1" }, { id: "s2" }];
const testCases = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];
const link = (source_type: CoverageEntityType, source_id: string, target_type: CoverageEntityType, target_id: string): CoverageLink => ({ source_type, source_id, target_type, target_id });
const direct = (requirementId: string, testId: string) => link("REQUIREMENT", requirementId, "TEST_CASE", testId);
const requirementStory = (requirementId: string, storyId: string) => link("REQUIREMENT", requirementId, "USER_STORY", storyId);
const storyTest = (storyId: string, testId: string) => link("USER_STORY", storyId, "TEST_CASE", testId);
const input = (links: CoverageLink[] = []) => ({ requirements, userStories, testCases, links });

describe("coverage percentage", () => {
  it.each([[0, 0, 0], [0, 3, 0], [1, 4, 25], [2, 4, 50], [4, 4, 100]])(
    "%s covered requirements out of %s gives %s percent", (covered, total, expected) => {
      expect(calculateCoveragePercentage(covered, total)).toBe(expected);
    },
  );
  it("keeps fractional precision for presentation to round later", () => {
    expect(calculateCoveragePercentage(1, 3)).toBeCloseTo(100 / 3, 10);
  });
});

describe("requirements without tests", () => {
  it("returns every requirement when there are no links", () => {
    const result = calculateCoverage(input());
    expect(result.requirementsWithoutTests).toEqual(requirements);
    expect(result.coveredRequirementCount).toBe(0);
    expect(result.totalRequirementCount).toBe(3);
    expect(result.coveragePercentage).toBe(0);
  });
  it("counts covered requirements rather than links or test cases", () => {
    const result = calculateCoverage(input([direct("r1", "t1"), direct("r1", "t2"), direct("r2", "t2")]));
    expect(result.requirementsWithoutTests).toEqual([requirements[2]]);
    expect(result.coveredRequirementCount).toBe(2);
    expect(result.coveragePercentage).toBeCloseTo(200 / 3);
  });
  it("counts test existence regardless of execution status", () => {
    const result = calculateCoverage({ ...input([direct("r1", "t1"), direct("r2", "t2")]), testCases: [{ id: "t1", status: "FAILED" }, { id: "t2", status: "NOT_RUN" }] });
    expect(result.coveredRequirementCount).toBe(2);
  });
});

describe("orphans and stories without requirements", () => {
  it("returns tests with no requirement, including tests linked only to an unassigned story", () => {
    const result = calculateCoverage(input([direct("r1", "t1"), storyTest("s2", "t2")]));
    expect(result.orphanTestCases).toEqual([testCases[1], testCases[2]]);
  });
  it("returns all tests as orphans when there are no requirements", () => {
    const result = calculateCoverage({ ...input([storyTest("s1", "t1")]), requirements: [] });
    expect(result.orphanTestCases).toEqual(testCases);
    expect(result.coveragePercentage).toBe(0);
  });
  it("requires a direct requirement-story link to assign a story", () => {
    const result = calculateCoverage(input([requirementStory("r1", "s1"), direct("r1", "t1"), storyTest("s2", "t1")]));
    expect(result.userStoriesWithoutRequirements).toEqual([userStories[1]]);
  });
});

describe("indirect coverage rule: requirement-story-test, at most two hops", () => {
  it("covers a requirement through a story and counts that test as non-orphan", () => {
    const result = calculateCoverage(input([requirementStory("r1", "s1"), storyTest("s1", "t1")]));
    expect(result.requirementsWithoutTests).toEqual([requirements[1], requirements[2]]);
    expect(result.orphanTestCases).toEqual([testCases[1], testCases[2]]);
    expect(result.coveragePercentage).toBeCloseTo(100 / 3);
  });
  it("lets one story-test pair cover multiple directly connected requirements", () => {
    const result = calculateCoverage(input([requirementStory("r1", "s1"), requirementStory("r2", "s1"), storyTest("s1", "t1")]));
    expect(result.coveredRequirementCount).toBe(2);
    expect(result.orphanTestCases).toEqual([testCases[1], testCases[2]]);
  });
  it("does not count a requirement-story link without a test", () => {
    expect(calculateCoverage(input([requirementStory("r1", "s1")])).requirementsWithoutTests).toEqual(requirements);
  });
  it("does not follow longer chains through a shared requirement", () => {
    const result = calculateCoverage(input([
      requirementStory("r1", "s1"), requirementStory("r2", "s1"),
      requirementStory("r2", "s2"), storyTest("s2", "t1"),
    ]));
    expect(result.requirementsWithoutTests).toEqual([requirements[0], requirements[2]]);
    expect(result.coveredRequirementCount).toBe(1);
  });
});

describe("direction, duplicates, and dangling links", () => {
  it("treats reversed direct and indirect links identically", () => {
    const links = [direct("r1", "t1"), requirementStory("r2", "s1"), storyTest("s1", "t2")];
    const reversed = links.map((edge) => link(edge.target_type, edge.target_id, edge.source_type, edge.source_id));
    expect(calculateCoverage(input(reversed))).toEqual(calculateCoverage(input(links)));
  });
  it("deduplicates repeated/reversed links and overlapping direct/indirect coverage", () => {
    const links = [direct("r1", "t1"), requirementStory("r1", "s1"), storyTest("s1", "t1")];
    const duplicates = links.flatMap((edge) => [edge, edge, link(edge.target_type, edge.target_id, edge.source_type, edge.source_id)]);
    const result = calculateCoverage(input(duplicates));
    expect(result).toEqual(calculateCoverage(input(links)));
    expect(result.coveredRequirementCount).toBe(1);
    expect(result.coveragePercentage).toBeCloseTo(100 / 3);
  });
  it("ignores missing endpoints instead of counting deleted or foreign items", () => {
    const result = calculateCoverage(input([
      direct("r1", "missing-test"), direct("missing-requirement", "t1"),
      requirementStory("r2", "missing-story"), storyTest("missing-story", "t2"),
    ]));
    expect(result.requirementsWithoutTests).toEqual(requirements);
    expect(result.orphanTestCases).toEqual(testCases);
    expect(result.userStoriesWithoutRequirements).toEqual(userStories);
  });
  it("ignores same-type edges rather than using arbitrary graph reachability", () => {
    const result = calculateCoverage(input([link("REQUIREMENT", "r1", "REQUIREMENT", "r2"), direct("r2", "t1")]));
    expect(result.requirementsWithoutTests).toEqual([requirements[0], requirements[2]]);
  });
  it("does not merge equal IDs from different item types", () => {
    const result = calculateCoverage({ requirements: [{ id: "shared" }], userStories: [{ id: "shared" }], testCases: [{ id: "t1" }], links: [storyTest("shared", "t1")] });
    expect(result.coveredRequirementCount).toBe(0);
    expect(result.orphanTestCases).toEqual([{ id: "t1" }]);
  });
});

describe("empty input and purity", () => {
  it("returns zero coverage and empty findings for empty arrays", () => {
    expect(calculateCoverage({ requirements: [], userStories: [], testCases: [], links: [] })).toEqual({
      requirementsWithoutTests: [], orphanTestCases: [], userStoriesWithoutRequirements: [],
      coveredRequirementCount: 0, totalRequirementCount: 0, coveragePercentage: 0,
    });
  });
  it("preserves item metadata and input order without mutating readonly arrays or objects", () => {
    const frozen = {
      requirements: Object.freeze(requirements.map((item) => Object.freeze({ ...item }))),
      userStories: Object.freeze(userStories.map((item) => Object.freeze({ ...item }))),
      testCases: Object.freeze(testCases.map((item) => Object.freeze({ ...item }))),
      links: Object.freeze([Object.freeze(direct("r2", "t1"))]),
    };
    const before = JSON.stringify(frozen);
    const result = calculateCoverage(frozen);
    expect(result.requirementsWithoutTests.map((item) => item.title)).toEqual(["First", "Third"]);
    expect(result.requirementsWithoutTests[0]).toBe(frozen.requirements[0]);
    expect(JSON.stringify(frozen)).toBe(before);
  });
});
