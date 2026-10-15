export type CoverageEntityType = "REQUIREMENT" | "USER_STORY" | "TEST_CASE";
export type CoverageItem = { id: string };
export type CoverageLink = {
  source_type: CoverageEntityType;
  source_id: string;
  target_type: CoverageEntityType;
  target_id: string;
};

export type CoverageInput<
  R extends CoverageItem = CoverageItem,
  S extends CoverageItem = CoverageItem,
  T extends CoverageItem = CoverageItem,
> = {
  requirements: readonly R[];
  userStories: readonly S[];
  testCases: readonly T[];
  links: readonly CoverageLink[];
};

export type CoverageResult<
  R extends CoverageItem = CoverageItem,
  S extends CoverageItem = CoverageItem,
  T extends CoverageItem = CoverageItem,
> = {
  requirementsWithoutTests: R[];
  orphanTestCases: T[];
  userStoriesWithoutRequirements: S[];
  coveredRequirementCount: number;
  totalRequirementCount: number;
  coveragePercentage: number;
};

/** Returns an unrounded percentage for valid coverage counts; an empty total is 0%. */
export function calculateCoveragePercentage(covered: number, total: number): number {
  return total === 0 ? 0 : (covered / total) * 100;
}

function connect(map: Map<string, Set<string>>, from: string, to: string) {
  const targets = map.get(from) ?? new Set<string>();
  targets.add(to);
  map.set(from, targets);
}

/**
 * Coverage rule: a requirement is covered by a direct requirement-test link OR
 * a two-hop requirement-story-test path through one story. Longer chains do not
 * count. Execution status is irrelevant: this measures test coverage, not passes.
 *
 * Links are undirected and duplicate/reversed edges count once. Tests connected
 * through either allowed path are non-orphan. Stories need a DIRECT requirement
 * link; a shared test does not assign a story to a requirement.
 *
 * Supply arrays scoped to one project, with unique item IDs within each type.
 * Missing endpoints and same-type edges are ignored. Output preserves input order
 * and item metadata; input arrays and objects are never mutated. No DB access.
 */
function analyzeCoverage<R extends CoverageItem, S extends CoverageItem, T extends CoverageItem>(
  input: CoverageInput<R, S, T>,
) {
  const { requirements, userStories, testCases, links } = input;
  const ids: Record<CoverageEntityType, Set<string>> = {
    REQUIREMENT: new Set(requirements.map((item) => item.id)),
    USER_STORY: new Set(userStories.map((item) => item.id)),
    TEST_CASE: new Set(testCases.map((item) => item.id)),
  };
  const rank: Record<CoverageEntityType, number> = { REQUIREMENT: 0, USER_STORY: 1, TEST_CASE: 2 };
  const requirementTests = new Map<string, Set<string>>();
  const requirementStories = new Map<string, Set<string>>();
  const storyTests = new Map<string, Set<string>>();
  const assignedStories = new Set<string>();

  for (const link of links) {
    let { source_type, source_id, target_type, target_id } = link;
    if (source_type === target_type || !ids[source_type]?.has(source_id) || !ids[target_type]?.has(target_id)) continue;
    // Normalize direction once so each meaningful pair has one representation.
    if (rank[source_type] > rank[target_type]) {
      [source_type, target_type] = [target_type, source_type];
      [source_id, target_id] = [target_id, source_id];
    }
    if (source_type === "REQUIREMENT" && target_type === "TEST_CASE") {
      connect(requirementTests, source_id, target_id);
    } else if (source_type === "REQUIREMENT" && target_type === "USER_STORY") {
      connect(requirementStories, source_id, target_id);
      assignedStories.add(target_id);
    } else if (source_type === "USER_STORY" && target_type === "TEST_CASE") {
      connect(storyTests, source_id, target_id);
    }
  }

  const coveredRequirements = new Set<string>();
  const coveredTests = new Set<string>();
  const testsByRequirement = new Map<string, Set<string>>();
  const indirectTestsByRequirement = new Map<string, Set<string>>();
  for (const requirement of requirements) {
    const tests = new Set(requirementTests.get(requirement.id));
    const indirect = new Set<string>();
    for (const storyId of requirementStories.get(requirement.id) ?? []) {
      for (const testId of storyTests.get(storyId) ?? []) { tests.add(testId); indirect.add(testId); }
    }
    testsByRequirement.set(requirement.id, tests);
    indirectTestsByRequirement.set(requirement.id, indirect);
    if (tests.size > 0) coveredRequirements.add(requirement.id);
    for (const testId of tests) coveredTests.add(testId);
  }

  const coverage: CoverageResult<R, S, T> = {
    requirementsWithoutTests: requirements.filter((item) => !coveredRequirements.has(item.id)),
    orphanTestCases: testCases.filter((item) => !coveredTests.has(item.id)),
    userStoriesWithoutRequirements: userStories.filter((item) => !assignedStories.has(item.id)),
    coveredRequirementCount: coveredRequirements.size,
    totalRequirementCount: requirements.length,
    coveragePercentage: calculateCoveragePercentage(coveredRequirements.size, requirements.length),
  };
  return { coverage, testsByRequirement, indirectTestsByRequirement };
}

/** Applies the direct-or-two-hop rule documented in analyzeCoverage. */
export function calculateCoverage<R extends CoverageItem, S extends CoverageItem, T extends CoverageItem>(
  input: CoverageInput<R, S, T>,
): CoverageResult<R, S, T> {
  return analyzeCoverage(input).coverage;
}

export type MatrixLink = CoverageLink & { id: string };
export type TraceMatrixCell = { testCaseId: string; covered: boolean; viaStory: boolean; directLinkIds: string[] };
export type TraceMatrixRow<R extends CoverageItem> = { requirement: R; coveredTestCount: number; isCovered: boolean; cells: TraceMatrixCell[] };
export type TraceMatrixModel<R extends CoverageItem, S extends CoverageItem, T extends CoverageItem> = {
  coverage: CoverageResult<R, S, T>;
  testCases: T[];
  rows: TraceMatrixRow<R>[];
};

/** Direct link IDs support editing, while story-only coverage remains read-only. */
export function calculateTraceMatrix<R extends CoverageItem, S extends CoverageItem, T extends CoverageItem>(
  input: Omit<CoverageInput<R, S, T>, "links"> & { links: readonly MatrixLink[] },
): TraceMatrixModel<R, S, T> {
  const { coverage, testsByRequirement, indirectTestsByRequirement } = analyzeCoverage(input);
  const directIds = new Map<string, Map<string, Set<string>>>();
  for (const link of input.links) {
    let requirementId: string;
    let testId: string;
    if (link.source_type === "REQUIREMENT" && link.target_type === "TEST_CASE") {
      requirementId = link.source_id; testId = link.target_id;
    } else if (link.source_type === "TEST_CASE" && link.target_type === "REQUIREMENT") {
      requirementId = link.target_id; testId = link.source_id;
    } else continue;
    const tests = directIds.get(requirementId) ?? new Map<string, Set<string>>();
    const ids = tests.get(testId) ?? new Set<string>();
    ids.add(link.id); tests.set(testId, ids); directIds.set(requirementId, tests);
  }
  return {
    coverage,
    testCases: [...input.testCases],
    rows: input.requirements.map((requirement) => {
      const tests = testsByRequirement.get(requirement.id)!;
      return {
        requirement, coveredTestCount: tests.size, isCovered: tests.size > 0,
        cells: input.testCases.map((test) => ({
          testCaseId: test.id,
          covered: tests.has(test.id),
          viaStory: indirectTestsByRequirement.get(requirement.id)!.has(test.id),
          directLinkIds: [...(directIds.get(requirement.id)?.get(test.id) ?? [])],
        })),
      };
    }),
  };
}
