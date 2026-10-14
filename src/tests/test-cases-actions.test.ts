import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), getOwnedProject: vi.fn(), transaction: vi.fn(), projectUpdate: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), deleteLinks: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("../lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("../lib/project-access", () => ({ getOwnedProject: mocks.getOwnedProject }));
vi.mock("../lib/db", () => ({ db: { $transaction: mocks.transaction, testCase: { updateMany: mocks.updateMany } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { createTestCase, updateTestCase, deleteTestCase } from "../app/projects/[id]/tests/actions";

const projectId = "a75b439b-4618-4edc-b7bd-a97a794367cb";
const id = "c25f85a1-fd21-40ae-ae03-93b1dd1a93f2";
const userId = "3f23afc1-0e50-49a1-9a8e-556c3af9a424";
const values = { title: "A test", steps: "First\nSecond", expected_result: "It succeeds", status: "NOT_RUN" };
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
  mocks.projectUpdate.mockResolvedValue({ test_seq: 1 });
  mocks.create.mockResolvedValue({ id, code: "TC-001" });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  mocks.deleteLinks.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (callback) => callback({ project: { update: mocks.projectUpdate }, testCase: { create: mocks.create, deleteMany: mocks.deleteMany }, link: { deleteMany: mocks.deleteLinks } }));
});
afterEach(() => vi.restoreAllMocks());

describe("test case actions", () => {
  it("allocates TC codes atomically and ignores submitted codes", async () => {
    expect((await createTestCase({}, form({ code: "FORGED", steps: " First\nSecond " }))).status).toBe("success");
    expect(mocks.projectUpdate).toHaveBeenCalledWith({ where: { id: projectId, owner_id: userId }, data: { test_seq: { increment: 1 } }, select: { test_seq: true } });
    expect(mocks.create).toHaveBeenCalledWith({ data: { ...values, project_id: projectId, code: "TC-001" }, select: { id: true, code: true } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}/tests`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}`, "layout");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
  it("supports TC codes beyond 999", async () => {
    mocks.projectUpdate.mockResolvedValue({ test_seq: 1000 });
    await createTestCase({}, form());
    expect(mocks.create.mock.calls[0][0].data.code).toBe("TC-1000");
  });
  it.each(["title", "steps", "expected_result"])("rejects blank %s before database access", async (field) => {
    for (const action of [createTestCase, updateTestCase]) expect((await action({}, form({ [field]: " " }))).fieldErrors?.[field]).toHaveLength(1);
    expect(mocks.getOwnedProject).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("rejects oversized text and invalid statuses", async () => {
    const result = await createTestCase({}, form({ steps: "x".repeat(10001), status: "APPROVED" }));
    expect(result.fieldErrors?.steps).toHaveLength(1);
    expect(result.fieldErrors?.status).toHaveLength(1);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([createTestCase, updateTestCase, deleteTestCase])("rejects unowned projects before mutation", async (action) => {
    mocks.getOwnedProject.mockResolvedValue(null);
    expect((await action({}, form())).status).toBe("error");
    expect(mocks.getOwnedProject).toHaveBeenCalledWith(projectId, userId);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it.each([createTestCase, updateTestCase, deleteTestCase])("preserves unauthenticated redirects", async (action) => {
    mocks.requireUser.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(action({}, form())).rejects.toThrow("REDIRECT:/login");
  });
  it.each(["NOT_RUN", "PASSED", "FAILED"])("saves status %s without changing the code", async (status) => {
    await updateTestCase({}, form({ status, code: "FORGED" }));
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id, project_id: projectId, project: { owner_id: userId } }, data: { ...values, status } });
  });
  it("rejects mismatched update targets", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect((await updateTestCase({}, form())).status).toBe("error");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("deletes only the owned test and its typed links in a transaction", async () => {
    expect((await deleteTestCase({}, form())).status).toBe("success");
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id, project_id: projectId, project: { owner_id: userId } } });
    expect(mocks.deleteLinks).toHaveBeenCalledWith({ where: { project_id: projectId, project: { owner_id: userId }, OR: [{ source_type: "TEST_CASE", source_id: id }, { target_type: "TEST_CASE", target_id: id }] } });
  });
  it("leaves links untouched when no test matches", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    expect((await deleteTestCase({}, form())).status).toBe("error");
    expect(mocks.deleteLinks).not.toHaveBeenCalled();
  });
  it("rejects malformed deletion IDs", async () => {
    expect((await deleteTestCase({}, form({ id: "invalid" }))).status).toBe("error");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("does not report transaction failures as success", async () => {
    mocks.create.mockRejectedValue(new Error("insert failed"));
    expect((await createTestCase({}, form())).status).toBe("error");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
