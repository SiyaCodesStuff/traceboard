import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), getOwnedProject: vi.fn(), transaction: vi.fn(), projectUpdate: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), deleteLinks: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("../lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("../lib/project-access", () => ({ getOwnedProject: mocks.getOwnedProject }));
vi.mock("../lib/db", () => ({ db: { $transaction: mocks.transaction, userStory: { updateMany: mocks.updateMany } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { createUserStory, updateUserStory, deleteUserStory } from "../app/projects/[id]/stories/actions";

const projectId = "a75b439b-4618-4edc-b7bd-a97a794367cb";
const id = "c25f85a1-fd21-40ae-ae03-93b1dd1a93f2";
const userId = "3f23afc1-0e50-49a1-9a8e-556c3af9a424";
const values = { title: "A story", as_a: "tester", i_want: "validation", so_that: "data stays consistent" };
function form(patch: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ project_id: projectId, id, ...values, ...patch }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.requireUser.mockResolvedValue({ id: userId });
  mocks.getOwnedProject.mockResolvedValue({ id: projectId });
  mocks.projectUpdate.mockResolvedValue({ story_seq: 1 });
  mocks.create.mockResolvedValue({ id, code: "US-001" });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  mocks.deleteLinks.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (callback) => callback({ project: { update: mocks.projectUpdate }, userStory: { create: mocks.create, deleteMany: mocks.deleteMany }, link: { deleteMany: mocks.deleteLinks } }));
});
afterEach(() => vi.restoreAllMocks());

describe("user story actions", () => {
  it("allocates the code inside a transaction and ignores forged code values", async () => {
    expect((await createUserStory({}, form({ code: "FORGED", as_a: " tester " }))).status).toBe("success");
    expect(mocks.projectUpdate).toHaveBeenCalledWith({ where: { id: projectId, owner_id: userId }, data: { story_seq: { increment: 1 } }, select: { story_seq: true } });
    expect(mocks.create).toHaveBeenCalledWith({ data: { ...values, project_id: projectId, code: "US-001" }, select: { id: true, code: true } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}/stories`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}`, "layout");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
  it("supports codes beyond 999", async () => {
    mocks.projectUpdate.mockResolvedValue({ story_seq: 1000 });
    await createUserStory({}, form());
    expect(mocks.create.mock.calls[0][0].data.code).toBe("US-1000");
  });
  it.each(["title", "as_a", "i_want", "so_that"])("rejects blank %s before database access", async (field) => {
    for (const action of [createUserStory, updateUserStory]) {
      expect((await action({}, form({ [field]: " " }))).fieldErrors?.[field]).toHaveLength(1);
    }
    expect(mocks.getOwnedProject).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("rejects oversized story fields", async () => {
    expect((await createUserStory({}, form({ so_that: "x".repeat(2001) }))).status).toBe("error");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([createUserStory, updateUserStory, deleteUserStory])("rejects unowned projects before mutation", async (action) => {
    mocks.getOwnedProject.mockResolvedValue(null);
    expect((await action({}, form())).status).toBe("error");
    expect(mocks.getOwnedProject).toHaveBeenCalledWith(projectId, userId);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it.each([createUserStory, updateUserStory, deleteUserStory])("preserves unauthenticated redirects", async (action) => {
    mocks.requireUser.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(action({}, form())).rejects.toThrow("REDIRECT:/login");
  });
  it("scopes updates by ID, project, and owner and leaves codes unchanged", async () => {
    await updateUserStory({}, form({ code: "FORGED", title: " Changed " }));
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id, project_id: projectId, project: { owner_id: userId } }, data: { ...values, title: "Changed" } });
  });
  it("rejects mismatched update targets", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect((await updateUserStory({}, form())).status).toBe("error");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("deletes the owned story and typed links atomically", async () => {
    expect((await deleteUserStory({}, form())).status).toBe("success");
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id, project_id: projectId, project: { owner_id: userId } } });
    expect(mocks.deleteLinks).toHaveBeenCalledWith({ where: { project_id: projectId, project: { owner_id: userId }, OR: [{ source_type: "USER_STORY", source_id: id }, { target_type: "USER_STORY", target_id: id }] } });
  });
  it("leaves links untouched if no story matches", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    expect((await deleteUserStory({}, form())).status).toBe("error");
    expect(mocks.deleteLinks).not.toHaveBeenCalled();
  });
  it("rejects malformed deletion IDs", async () => {
    expect((await deleteUserStory({}, form({ id: "invalid" }))).status).toBe("error");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("does not revalidate after transaction failure", async () => {
    mocks.create.mockRejectedValue(new Error("insert failed"));
    expect((await createUserStory({}, form())).status).toBe("error");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
