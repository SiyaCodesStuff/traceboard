import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// RUN_LINKS_INTEGRATION=1 opts in; all data belongs to temporary projects.
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("../lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe.skipIf(process.env.RUN_LINKS_INTEGRATION !== "1")("live link actions", () => {
  let db: typeof import("../lib/db")["db"];
  let actions: typeof import("../app/projects/[id]/links/actions");
  let projectId: string;
  let otherProjectId: string;
  let userId: string;
  let otherUserId: string;
  let requirementId: string;
  let storyId: string;
  let testId: string;
  let foreignId: string;
  let createdId: string;
  function form(patch: Record<string, string> = {}) {
    const data = new FormData();
    Object.entries({ project_id: projectId, source_type: "REQUIREMENT", source_id: requirementId, target_type: "USER_STORY", target_id: storyId, ...patch }).forEach(([key, value]) => data.set(key, value));
    return data;
  }
  beforeAll(async () => {
    config({ path: ".env.local", quiet: true });
    for (const suffix of ["A", "B"]) {
      const api = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await api.auth.signInWithPassword({ email: process.env[`RLS_TEST_USER_${suffix}_EMAIL`]!, password: process.env[`RLS_TEST_USER_${suffix}_PASSWORD`]! });
      if (error) throw new Error(`Test account ${suffix} sign-in failed`);
      if (suffix === "A") userId = data.user.id; else otherUserId = data.user.id;
    }
    ({ db } = await import("../lib/db"));
    actions = await import("../app/projects/[id]/links/actions");
    projectId = (await db.project.create({ data: { name: "Temporary link verification", owner_id: userId } })).id;
    otherProjectId = (await db.project.create({ data: { name: "Temporary foreign endpoint verification", owner_id: userId } })).id;
    requirementId = (await db.requirement.create({ data: { project_id: projectId, code: "REQ-001", title: "Requirement", priority: "HIGH", status: "DRAFT" } })).id;
    storyId = (await db.userStory.create({ data: { project_id: projectId, code: "US-001", title: "Story", as_a: "tester", i_want: "links", so_that: "work is connected" } })).id;
    testId = (await db.testCase.create({ data: { project_id: projectId, code: "TC-001", title: "Test", steps: "Check", expected_result: "Pass", status: "NOT_RUN" } })).id;
    foreignId = (await db.testCase.create({ data: { project_id: otherProjectId, code: "TC-001", title: "Foreign test", steps: "Check", expected_result: "Pass", status: "NOT_RUN" } })).id;
    mocks.requireUser.mockResolvedValue({ id: userId });
    vi.spyOn(console, "error").mockImplementation(() => {});
  }, 60000);
  afterAll(async () => {
    try { if (db) await db.project.deleteMany({ where: { id: { in: [projectId, otherProjectId].filter(Boolean) }, owner_id: userId } }); }
    finally { if (db) await db.$disconnect(); vi.restoreAllMocks(); }
  }, 30000);
  it("prevents duplicate links even when opposite directions are created concurrently", async () => {
    const results = await Promise.all([
      actions.createLink({}, form()),
      actions.createLink({}, form({ source_type: "USER_STORY", source_id: storyId, target_type: "REQUIREMENT", target_id: requirementId })),
      actions.createLink({}, form()),
    ]);
    expect(results.filter((result) => result.status === "success")).toHaveLength(1);
    expect(results.filter((result) => result.status === "error")).toHaveLength(2);
    createdId = results.find((result) => result.status === "success")!.id!;
    expect(await db.link.count({ where: { project_id: projectId, project: { owner_id: userId } } })).toBe(1);
  }, 60000);
  it("rejects self-links, same types, and endpoints from a different project", async () => {
    const invalid: Record<string, string>[] = [
      { target_id: requirementId },
      { target_type: "REQUIREMENT", target_id: storyId },
      { target_type: "TEST_CASE", target_id: foreignId },
    ];
    for (const patch of invalid) expect((await actions.createLink({}, form(patch))).status).toBe("error");
  }, 30000);
  it("allows all three meaningful pairs and exposes current links from either side", async () => {
    expect((await actions.createLink({}, form({ target_type: "TEST_CASE", target_id: testId }))).status).toBe("success");
    expect((await actions.createLink({}, form({ source_type: "USER_STORY", source_id: storyId, target_type: "TEST_CASE", target_id: testId }))).status).toBe("success");
    const fromTest = await actions.getLinkOptions(form({ source_type: "TEST_CASE", source_id: testId }));
    expect(fromTest.data?.current).toHaveLength(2);
    expect(fromTest.data?.options).toHaveLength(0);
  }, 30000);
  it("enforces ownership for listing and writes and removes an owned link", async () => {
    mocks.requireUser.mockResolvedValue({ id: otherUserId });
    expect((await actions.createLink({}, form())).status).toBe("error");
    expect((await actions.deleteLink({}, form({ id: createdId }))).status).toBe("error");
    expect((await actions.getLinkOptions(form())).error).toBeTruthy();
    mocks.requireUser.mockResolvedValue({ id: userId });
    expect((await actions.deleteLink({}, form({ id: createdId, project_id: otherProjectId }))).status).toBe("error");
    expect((await actions.deleteLink({}, form({ id: createdId }))).status).toBe("success");
    expect(await db.link.count({ where: { id: createdId, project_id: projectId, project: { owner_id: userId } } })).toBe(0);
  }, 30000);
});
