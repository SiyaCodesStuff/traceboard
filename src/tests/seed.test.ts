import { describe, expect, it } from "vitest";
import { bankingDemo } from "../../prisma/seed-data";
import { calculateCoverage } from "../lib/coverage";

const owner = "a75b439b-4618-4edc-b7bd-a97a794367cb";
describe("banking demo seed", () => {
  it("uses stable, user-specific UUIDs and keeps code counters aligned", () => {
    const data = bankingDemo(owner);
    expect(bankingDemo(owner)).toEqual(data);
    expect(bankingDemo("c25f85a1-fd21-40ae-ae03-93b1dd1a93f2").id).not.toBe(data.id);
    expect(data.owner_id).toBe(owner);
    const groups = [data.requirements.create, data.user_stories.create, data.test_cases.create];
    expect(groups.map((items) => items.length)).toEqual([8, 6, 10]);
    expect([data.req_seq, data.story_seq, data.test_seq]).toEqual([8, 6, 10]);
    const ids = [data.id, ...groups.flat().map((item) => item.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-8[\da-f]{3}-[\da-f]{12}$/);
  });
  it("has deliberate coverage gaps under the shared direct-or-story rule", () => {
    const data = bankingDemo(owner);
    const coverage = calculateCoverage({ requirements: data.requirements.create, userStories: data.user_stories.create, testCases: data.test_cases.create, links: data.links.create });
    expect(coverage.coveragePercentage).toBe(62.5);
    expect(coverage.requirementsWithoutTests.map((item) => item.code)).toEqual(["REQ-005", "REQ-007", "REQ-008"]);
    expect(coverage.orphanTestCases.map((item) => item.code)).toEqual(["TC-009", "TC-010"]);
    expect(coverage.userStoriesWithoutRequirements.map((item) => item.code)).toEqual(["US-005", "US-006"]);
  });
});
