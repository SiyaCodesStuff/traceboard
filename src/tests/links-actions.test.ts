import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), getOwnedProject: vi.fn(), transaction: vi.fn(), query: vi.fn(), findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), requirements: vi.fn(), stories: vi.fn(), tests: vi.fn(), links: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("../lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("../lib/project-access", () => ({ getOwnedProject: mocks.getOwnedProject }));
vi.mock("../lib/db", () => ({ db: { $transaction: mocks.transaction, requirement: { findMany: mocks.requirements }, userStory: { findMany: mocks.stories }, testCase: { findMany: mocks.tests }, link: { findMany: mocks.links } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { createLink, deleteLink, getLinkOptions } from "../app/projects/[id]/links/actions";
import { linkCreateSchema } from "../lib/validators";

const projectId = "a75b439b-4618-4edc-b7bd-a97a794367cb";
const sourceId = "c25f85a1-fd21-40ae-ae03-93b1dd1a93f2";
const targetId = "3f23afc1-0e50-49a1-9a8e-556c3af9a424";
const testId = "51e80824-b390-421c-af65-5eb5321ae727";
const linkId = "737bd5a3-2100-497f-a5bb-e4b91d8e5cde";
const userId = "665d9c33-fd5d-4a6b-b22c-9395be51218d";
const fields = { project_id: projectId, source_type: "REQUIREMENT", source_id: sourceId, target_type: "USER_STORY", target_id: targetId };
function form(patch: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ ...fields, id: linkId, ...patch }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.requireUser.mockResolvedValue({ id: userId });
  mocks.getOwnedProject.mockResolvedValue({ id: projectId });
  mocks.query.mockResolvedValue([{ id: projectId }]);
  mocks.findFirst.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: linkId });
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (callback) => callback({ $queryRaw: mocks.query, link: { findFirst: mocks.findFirst, create: mocks.create, deleteMany: mocks.deleteMany } }));
  mocks.requirements.mockResolvedValue([{ id: sourceId, code: "REQ-001", title: "Requirement" }]);
  mocks.stories.mockResolvedValue([{ id: targetId, code: "US-001", title: "Story" }]);
  mocks.tests.mockResolvedValue([{ id: testId, code: "TC-001", title: "Test" }]);
  mocks.links.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("link validation", () => {
  it.each([
    ["REQUIREMENT", "USER_STORY"], ["USER_STORY", "REQUIREMENT"],
    ["REQUIREMENT", "TEST_CASE"], ["TEST_CASE", "REQUIREMENT"],
    ["USER_STORY", "TEST_CASE"], ["TEST_CASE", "USER_STORY"],
  ])("permits %s to %s", (source_type, target_type) => {
    expect(linkCreateSchema.safeParse({ ...fields, source_type, target_type }).success).toBe(true);
  });
  it.each(["REQUIREMENT", "USER_STORY", "TEST_CASE"])("rejects same-type %s links", (type) => {
    expect(linkCreateSchema.safeParse({ ...fields, source_type: type, target_type: type }).success).toBe(false);
  });
  it("rejects self-links and malformed endpoints", () => {
    expect(linkCreateSchema.safeParse({ ...fields, target_id: sourceId }).success).toBe(false);
    expect(linkCreateSchema.safeParse({ ...fields, target_id: "invalid" }).success).toBe(false);
  });
});

describe("link actions", () => {
  it("locks the owned project and both endpoints before checking both duplicate directions", async () => {
    expect((await createLink({}, form())).status).toBe("success");
    expect(mocks.getOwnedProject).toHaveBeenCalledWith(projectId, userId);
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.query.mock.calls[0].slice(1)).toEqual([projectId, userId]);
    expect(mocks.query.mock.calls[1].slice(1)).toEqual([sourceId, projectId]);
    expect(mocks.query.mock.calls[2].slice(1)).toEqual([targetId, projectId]);
    expect(mocks.findFirst.mock.calls[0][0].where).toEqual({ project_id: projectId, project: { owner_id: userId }, OR: [
      { source_type: "REQUIREMENT", source_id: sourceId, target_type: "USER_STORY", target_id: targetId },
      { source_type: "USER_STORY", source_id: targetId, target_type: "REQUIREMENT", target_id: sourceId },
    ] });
    expect(mocks.create).toHaveBeenCalledWith({ data: fields, select: { id: true } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}`, "layout");
  });
  it("rejects duplicates without writing", async () => {
    mocks.findFirst.mockResolvedValue({ id: linkId });
    expect((await createLink({}, form())).message).toContain("already linked");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it.each([1, 2])("rejects a missing or cross-project endpoint at position %s", async (position) => {
    mocks.query.mockReset();
    mocks.query.mockResolvedValue([{ id: sourceId }]);
    for (let i = 0; i < position; i++) mocks.query.mockResolvedValueOnce([{ id: sourceId }]);
    mocks.query.mockResolvedValueOnce([]);
    expect((await createLink({}, form())).message).toContain("Both items");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects ownership changes before the project lock", async () => {
    mocks.query.mockResolvedValue([]);
    expect((await createLink({}, form())).status).toBe("error");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([createLink, deleteLink])("requires ownership before opening a write transaction", async (action) => {
    mocks.getOwnedProject.mockResolvedValue(null);
    expect((await action({}, form())).status).toBe("error");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([createLink, deleteLink])("preserves unauthenticated redirects", async (action) => {
    mocks.requireUser.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(action({}, form())).rejects.toThrow("REDIRECT:/login");
  });
  it("validates before touching the database", async () => {
    expect((await createLink({}, form({ target_id: sourceId }))).status).toBe("error");
    expect((await deleteLink({}, form({ id: "invalid" }))).status).toBe("error");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("checks both endpoints and scopes removal by link, project, and owner", async () => {
    mocks.findFirst.mockResolvedValue({ id: linkId, ...fields });
    expect((await deleteLink({}, form())).status).toBe("success");
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: linkId, project_id: projectId, project: { owner_id: userId } } });
  });
  it("does not remove links whose endpoints are missing", async () => {
    mocks.findFirst.mockResolvedValue({ id: linkId, ...fields });
    mocks.query.mockResolvedValueOnce([{ id: projectId }]).mockResolvedValueOnce([]);
    expect((await deleteLink({}, form())).status).toBe("error");
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
  it("does not remove missing or wrong-project links", async () => {
    expect((await deleteLink({}, form())).status).toBe("error");
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
  it("handles transaction errors", async () => {
    mocks.transaction.mockRejectedValue(new Error("database unavailable"));
    expect((await createLink({}, form())).status).toBe("error");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("link picker data", () => {
  it("returns other item types, hides current links in either direction, and scopes every query", async () => {
    mocks.links.mockResolvedValue([{ id: linkId, source_type: "USER_STORY", source_id: targetId, target_type: "REQUIREMENT", target_id: sourceId }]);
    const result = await getLinkOptions(form());
    expect(result.data?.current).toEqual([{ id: linkId, item: { id: targetId, type: "USER_STORY", code: "US-001", title: "Story" } }]);
    expect(result.data?.options).toEqual([{ id: testId, type: "TEST_CASE", code: "TC-001", title: "Test" }]);
    for (const mock of [mocks.requirements, mocks.stories, mocks.tests, mocks.links]) expect(mock.mock.calls[0][0].where).toMatchObject({ project_id: projectId, project: { owner_id: userId } });
  });
  it("refuses missing source items", async () => {
    mocks.requirements.mockResolvedValue([]);
    expect((await getLinkOptions(form())).error).toContain("Item not found");
  });
  it("does not read another user's project", async () => {
    mocks.getOwnedProject.mockResolvedValue(null);
    expect((await getLinkOptions(form())).error).toBeTruthy();
    expect(mocks.requirements).not.toHaveBeenCalled();
  });
});
