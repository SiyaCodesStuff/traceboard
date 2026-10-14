import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Opt in with RUN_STORIES_INTEGRATION=1; all writes belong to a temporary project.
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("../lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe.skipIf(process.env.RUN_STORIES_INTEGRATION !== "1")("live story transactions", () => {
  let db: typeof import("../lib/db")["db"];
  let actions: typeof import("../app/projects/[id]/stories/actions");
  let projectId: string;
  let userId: string;
  let otherUserId: string;
  let storyId: string;
  const fields = { title: "Temporary story", as_a: "tester", i_want: "unique codes", so_that: "concurrent creates are safe" };
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
    actions = await import("../app/projects/[id]/stories/actions");
    mocks.requireUser.mockResolvedValue({ id: userId });
    projectId = (await db.project.create({ data: { name: "Temporary story transaction verification", owner_id: userId }, select: { id: true } })).id;
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
  it("allocates unique sequential US codes under concurrent creates", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => actions.createUserStory({}, form())));
    expect(results.every((result) => result.status === "success")).toBe(true);
    expect(results.map((result) => result.code).sort()).toEqual(["US-001", "US-002", "US-003", "US-004", "US-005"]);
    storyId = results[0].id!;
    expect(await db.project.findFirstOrThrow({ where: { id: projectId, owner_id: userId }, select: { story_seq: true, req_seq: true, test_seq: true } })).toEqual({ story_seq: 5, req_seq: 0, test_seq: 0 });
  }, 60000);
  it("rolls back the sequence when story insertion fails", async () => {
    const conflict = await db.userStory.create({ data: { ...fields, project_id: projectId, code: "US-006" } });
    expect((await actions.createUserStory({}, form())).status).toBe("error");
    expect((await db.project.findFirstOrThrow({ where: { id: projectId, owner_id: userId } })).story_seq).toBe(5);
    await db.userStory.deleteMany({ where: { id: conflict.id, project_id: projectId, project: { owner_id: userId } } });
  }, 30000);
  it("rejects cross-owner writes and removes story links without deleting requirements", async () => {
    mocks.requireUser.mockResolvedValue({ id: otherUserId });
    for (const action of [actions.createUserStory, actions.updateUserStory, actions.deleteUserStory]) {
      expect((await action({}, form({ id: storyId }))).status).toBe("error");
    }
    mocks.requireUser.mockResolvedValue({ id: userId });
    expect((await actions.updateUserStory({}, form({ id: storyId, title: "Updated story", code: "FORGED" }))).status).toBe("success");
    expect((await db.userStory.findFirstOrThrow({ where: { id: storyId, project_id: projectId, project: { owner_id: userId } } })).code).toMatch(/^US-00[1-5]$/);
    const requirement = await db.requirement.create({ data: { project_id: projectId, code: "REQ-001", title: "Temporary linked requirement", priority: "LOW", status: "DRAFT" } });
    await db.link.createMany({ data: [
      { project_id: projectId, source_type: "USER_STORY", source_id: storyId, target_type: "REQUIREMENT", target_id: requirement.id },
      { project_id: projectId, source_type: "REQUIREMENT", source_id: requirement.id, target_type: "USER_STORY", target_id: storyId },
    ] });
    expect((await actions.deleteUserStory({}, form({ id: storyId }))).status).toBe("success");
    expect(await db.link.count({ where: { project_id: projectId, project: { owner_id: userId } } })).toBe(0);
    expect(await db.requirement.count({ where: { id: requirement.id, project_id: projectId, project: { owner_id: userId } } })).toBe(1);
  }, 30000);
});
