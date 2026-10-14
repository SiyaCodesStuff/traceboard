import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Opt in with RUN_TEST_CASES_INTEGRATION=1; writes are confined to a temporary project.
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("../lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe.skipIf(process.env.RUN_TEST_CASES_INTEGRATION !== "1")("live test case transactions", () => {
  let db: typeof import("../lib/db")["db"];
  let actions: typeof import("../app/projects/[id]/tests/actions");
  let projectId: string;
  let userId: string;
  let otherUserId: string;
  let testId: string;
  const fields = { title: "Temporary test", steps: "First\nSecond", expected_result: "The operation succeeds", status: "NOT_RUN" };
  function form(patch: Record<string, string> = {}) {
    const data = new FormData();
    Object.entries({ project_id: projectId, ...fields, ...patch }).forEach(([key, value]) => data.set(key, value));
    return data;
  }
  beforeAll(async () => {
    config({ path: ".env.local", quiet: true });
    for (const suffix of ["A", "B"]) {
      const api = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await api.auth.signInWithPassword({ email: process.env[`RLS_TEST_USER_${suffix}_EMAIL`]!, password: process.env[`RLS_TEST_USER_${suffix}_PASSWORD`]! });
      if (error) throw new Error(`Test account ${suffix} sign-in failed`);
      if (suffix === "A") userId = data.user.id;
      else otherUserId = data.user.id;
    }
    ({ db } = await import("../lib/db"));
    actions = await import("../app/projects/[id]/tests/actions");
    mocks.requireUser.mockResolvedValue({ id: userId });
    projectId = (await db.project.create({ data: { name: "Temporary test case transaction verification", owner_id: userId }, select: { id: true } })).id;
    vi.spyOn(console, "error").mockImplementation(() => {});
  }, 60000);
  afterAll(async () => {
    try {
      if (projectId) await db.project.deleteMany({ where: { id: projectId, owner_id: userId } });
    } finally {
      if (db) await db.$disconnect();
      vi.restoreAllMocks();
    }
  }, 30000);
  it("allocates concurrent TC codes without changing the other counters", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => actions.createTestCase({}, form())));
    expect(results.every((result) => result.status === "success")).toBe(true);
    expect(results.map((result) => result.code).sort()).toEqual(["TC-001", "TC-002", "TC-003", "TC-004", "TC-005"]);
    testId = results[0].id!;
    expect(await db.project.findFirstOrThrow({ where: { id: projectId, owner_id: userId }, select: { test_seq: true, req_seq: true, story_seq: true } })).toEqual({ test_seq: 5, req_seq: 0, story_seq: 0 });
  }, 60000);
  it("rolls back counter increments when creation fails", async () => {
    const conflict = await db.testCase.create({ data: { ...fields, status: "NOT_RUN", project_id: projectId, code: "TC-006" } });
    expect((await actions.createTestCase({}, form())).status).toBe("error");
    expect((await db.project.findFirstOrThrow({ where: { id: projectId, owner_id: userId } })).test_seq).toBe(5);
    await db.testCase.deleteMany({ where: { id: conflict.id, project_id: projectId, project: { owner_id: userId } } });
  }, 30000);
  it("rejects cross-owner writes, saves all statuses, and removes links without deleting requirements", async () => {
    mocks.requireUser.mockResolvedValue({ id: otherUserId });
    for (const action of [actions.createTestCase, actions.updateTestCase, actions.deleteTestCase]) expect((await action({}, form({ id: testId }))).status).toBe("error");
    mocks.requireUser.mockResolvedValue({ id: userId });
    for (const status of ["PASSED", "FAILED", "NOT_RUN"]) {
      expect((await actions.updateTestCase({}, form({ id: testId, status, code: "FORGED" }))).status).toBe("success");
      const test = await db.testCase.findFirstOrThrow({ where: { id: testId, project_id: projectId, project: { owner_id: userId } } });
      expect(test.status).toBe(status);
      expect(test.code).toMatch(/^TC-00[1-5]$/);
    }
    const requirement = await db.requirement.create({ data: { project_id: projectId, code: "REQ-001", title: "Temporary linked requirement", priority: "LOW", status: "DRAFT" } });
    await db.link.createMany({ data: [
      { project_id: projectId, source_type: "TEST_CASE", source_id: testId, target_type: "REQUIREMENT", target_id: requirement.id },
      { project_id: projectId, source_type: "REQUIREMENT", source_id: requirement.id, target_type: "TEST_CASE", target_id: testId },
    ] });
    expect((await actions.deleteTestCase({}, form({ id: testId }))).status).toBe("success");
    expect(await db.link.count({ where: { project_id: projectId, project: { owner_id: userId } } })).toBe(0);
    expect(await db.requirement.count({ where: { id: requirement.id, project_id: projectId, project: { owner_id: userId } } })).toBe(1);
  }, 30000);
});
