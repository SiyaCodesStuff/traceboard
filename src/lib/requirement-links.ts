import { EntityType } from "./validators";

type EndpointLink = { source_type: EntityType; source_id: string; target_type: EntityType; target_id: string };

export function getLinkedTestCounts(links: EndpointLink[], existingTestIds: string[]) {
  const existingTests = new Set(existingTestIds);
  const testsByRequirement = new Map<string, Set<string>>();
  for (const link of links) {
    let requirementId: string;
    let testId: string;
    if (link.source_type === EntityType.REQUIREMENT && link.target_type === EntityType.TEST_CASE) {
      requirementId = link.source_id;
      testId = link.target_id;
    } else if (link.target_type === EntityType.REQUIREMENT && link.source_type === EntityType.TEST_CASE) {
      requirementId = link.target_id;
      testId = link.source_id;
    } else continue;
    if (!existingTests.has(testId)) continue;
    const tests = testsByRequirement.get(requirementId) ?? new Set<string>();
    tests.add(testId);
    testsByRequirement.set(requirementId, tests);
  }
  return new Map([...testsByRequirement].map(([id, tests]) => [id, tests.size]));
}
