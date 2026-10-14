import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), getOwnedProject: vi.fn(), transaction: vi.fn(),
  projectUpdate: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), deleteLinks: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("../lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("../lib/project-access", () => ({ getOwnedProject: mocks.getOwnedProject }));
vi.mock("../lib/db", () => ({ db: { $transaction: mocks.transaction, requirement: { updateMany: mocks.updateMany } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { createRequirement, updateRequirement, deleteRequirement } from "../app/projects/[id]/requirements/actions";

const projectId = "a75b439b-4618-4edc-b7bd-a97a794367cb";
const id = "c25f85a1-fd21-40ae-ae03-93b1dd1a93f2";
const userId = "3f23afc1-0e50-49a1-9a8e-556c3af9a424";
function form(patch: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ project_id: projectId, id, title: "  Valid requirement  ", description: " Notes ", priority: "HIGH", status: "DRAFT", ...patch }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.requireUser.mockResolvedValue({ id: userId });
  mocks.getOwnedProject.mockResolvedValue({ id: projectId });
  mocks.projectUpdate.mockResolvedValue({ req_seq: 1 });
  mocks.create.mockResolvedValue({ id, code: "REQ-001" });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  mocks.deleteLinks.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (callback) => callback({ project: { update: mocks.projectUpdate }, requirement: { create: mocks.create, deleteMany: mocks.deleteMany }, link: { deleteMany: mocks.deleteLinks } }));
});
afterEach(() => vi.restoreAllMocks());

describe("requirement writes", () => {
  it("increments the owned project's sequence and creates the code inside the same transaction", async () => {
    expect((await createRequirement({}, form({ code: "FORGED" }))).status).toBe("success");
    expect(mocks.getOwnedProject).toHaveBeenCalledWith(projectId, userId);
    expect(mocks.projectUpdate).toHaveBeenCalledWith({ where: { id: projectId, owner_id: userId }, data: { req_seq: { increment: 1 } }, select: { req_seq: true } });
    expect(mocks.create).toHaveBeenCalledWith({ data: { project_id: projectId, code: "REQ-001", title: "Valid requirement", description: "Notes", priority: "HIGH", status: "DRAFT" }, select: { id: true, code: true } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}/requirements`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}`, "layout");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
  it("does not truncate codes after 999", async () => {
    mocks.projectUpdate.mockResolvedValue({ req_seq: 1000 });
    await createRequirement({}, form());
    expect(mocks.create.mock.calls[0][0].data.code).toBe("REQ-1000");
  });
  it.each([createRequirement, updateRequirement])("validates fields before querying ownership", async (action) => {
    const state = await action({}, form({ title: " ", priority: "URGENT", status: "FAILED" }));
    expect(state.fieldErrors?.title).toHaveLength(1);
    expect(mocks.getOwnedProject).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it.each([createRequirement, updateRequirement, deleteRequirement])("checks authentication and project ownership before mutation", async (action) => {
    mocks.getOwnedProject.mockResolvedValue(null);
    expect((await action({}, form())).status).toBe("error");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it.each([createRequirement, updateRequirement, deleteRequirement])("preserves unauthenticated redirects", async (action) => {
    mocks.requireUser.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(action({}, form())).rejects.toThrow("REDIRECT:/login");
    expect(mocks.getOwnedProject).not.toHaveBeenCalled();
  });
  it("keeps codes immutable and scopes requirement updates by project and owner", async () => {
    await updateRequirement({}, form({ code: "FORGED", description: " " }));
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id, project_id: projectId, project: { owner_id: userId } }, data: { title: "Valid requirement", description: null, priority: "HIGH", status: "DRAFT" } });
  });
  it("rejects missing or mismatched update targets", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect((await updateRequirement({}, form())).status).toBe("error");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("deletes only the owned requirement and its typed links in a transaction", async () => {
    expect((await deleteRequirement({}, form())).status).toBe("success");
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id, project_id: projectId, project: { owner_id: userId } } });
    expect(mocks.deleteLinks).toHaveBeenCalledWith({ where: { project_id: projectId, project: { owner_id: userId }, OR: [{ source_type: "REQUIREMENT", source_id: id }, { target_type: "REQUIREMENT", target_id: id }] } });
  });
  it("does not delete links when no requirement matches", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    expect((await deleteRequirement({}, form())).status).toBe("error");
    expect(mocks.deleteLinks).not.toHaveBeenCalled();
  });
  it("rejects malformed deletion IDs", async () => {
    expect((await deleteRequirement({}, form({ id: "invalid" }))).status).toBe("error");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("returns transaction failures without reporting success", async () => {
    mocks.create.mockRejectedValue(new Error("insert failed"));
    expect((await createRequirement({}, form())).status).toBe("error");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
