import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Opt in with RUN_REQUIREMENTS_INTEGRATION=1; only temporary project data is mutated.
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("../lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe.skipIf(process.env.RUN_REQUIREMENTS_INTEGRATION !== "1")("live requirement transactions", () => {
  let db: typeof import("../lib/db")["db"];
  let actions: typeof import("../app/projects/[id]/requirements/actions");
  let projectId: string;
  let userId: string;
  let otherUserId: string;
  let requirementId: string;
  function form(patch: Record<string, string> = {}) {
    const data = new FormData();
    Object.entries({ project_id: projectId, title: "Temporary concurrency check", priority: "MEDIUM", status: "DRAFT", ...patch }).forEach(([key, value]) => data.set(key, value));
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
    actions = await import("../app/projects/[id]/requirements/actions");
    mocks.requireUser.mockResolvedValue({ id: userId });
    projectId = (await db.project.create({ data: { name: "Temporary requirement transaction verification", owner_id: userId }, select: { id: true } })).id;
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
  it("allocates five unique sequential codes under concurrent creates", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => actions.createRequirement({}, form())));
    expect(results.every((result) => result.status === "success")).toBe(true);
    expect(results.map((result) => result.code).sort()).toEqual(["REQ-001", "REQ-002", "REQ-003", "REQ-004", "REQ-005"]);
    requirementId = results[0].id!;
    expect((await db.project.findFirstOrThrow({ where: { id: projectId, owner_id: userId } })).req_seq).toBe(5);
  }, 60000);
  it("rolls back the sequence increment when the insert fails", async () => {
    const conflicting = await db.requirement.create({ data: { project_id: projectId, code: "REQ-006", title: "Temporary conflict", priority: "LOW", status: "DRAFT" } });
    expect((await actions.createRequirement({}, form())).status).toBe("error");
    expect((await db.project.findFirstOrThrow({ where: { id: projectId, owner_id: userId } })).req_seq).toBe(5);
    await db.requirement.deleteMany({ where: { id: conflicting.id, project_id: projectId, project: { owner_id: userId } } });
  }, 30000);
  it("denies cross-owner writes and deletes typed links while preserving tests", async () => {
    mocks.requireUser.mockResolvedValue({ id: otherUserId });
    for (const action of [actions.createRequirement, actions.updateRequirement, actions.deleteRequirement]) {
      expect((await action({}, form({ id: requirementId }))).status).toBe("error");
    }
    mocks.requireUser.mockResolvedValue({ id: userId });
    const test = await db.testCase.create({ data: { project_id: projectId, code: "TEST-001", title: "Temporary linked test", steps: "Check", expected_result: "Pass", status: "NOT_RUN" } });
    await db.link.createMany({ data: [
      { project_id: projectId, source_type: "REQUIREMENT", source_id: requirementId, target_type: "TEST_CASE", target_id: test.id },
      { project_id: projectId, source_type: "TEST_CASE", source_id: test.id, target_type: "REQUIREMENT", target_id: requirementId },
    ] });
    expect((await actions.deleteRequirement({}, form({ id: requirementId }))).status).toBe("success");
    expect(await db.link.count({ where: { project_id: projectId, project: { owner_id: userId } } })).toBe(0);
    expect(await db.testCase.count({ where: { id: test.id, project_id: projectId, project: { owner_id: userId } } })).toBe(1);
  }, 30000);
});
