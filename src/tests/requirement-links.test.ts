import { describe, expect, it } from "vitest";
import { getLinkedTestCounts } from "../lib/requirement-links";
import { EntityType } from "../lib/validators";

describe("linked test counts", () => {
  it("counts distinct existing tests in both link directions", () => {
    const counts = getLinkedTestCounts([
      { source_type: EntityType.REQUIREMENT, source_id: "req", target_type: EntityType.TEST_CASE, target_id: "test-1" },
      { source_type: EntityType.TEST_CASE, source_id: "test-1", target_type: EntityType.REQUIREMENT, target_id: "req" },
      { source_type: EntityType.TEST_CASE, source_id: "test-2", target_type: EntityType.REQUIREMENT, target_id: "req" },
      { source_type: EntityType.REQUIREMENT, source_id: "req", target_type: EntityType.TEST_CASE, target_id: "missing" },
      { source_type: EntityType.REQUIREMENT, source_id: "req", target_type: EntityType.USER_STORY, target_id: "test-1" },
    ], ["test-1", "test-2"]);
    expect(counts.get("req")).toBe(2);
  });
  it("returns no counts for empty links", () => {
    expect(getLinkedTestCounts([], []).size).toBe(0);
  });
});
