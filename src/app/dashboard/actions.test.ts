import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), revalidatePath: vi.fn(), getOwnedProject: vi.fn() }));
vi.mock("../../lib/project-access", () => ({ getOwnedProject: mocks.getOwnedProject }));
vi.mock("../../lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("../../lib/db", () => ({ db: { project: { create: mocks.create, deleteMany: mocks.deleteMany } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { createProject, deleteProject } from "./actions";

const userId = "a75b439b-4618-4edc-b7bd-a97a794367cb";
const projectId = "c25f85a1-fd21-40ae-ae03-93b1dd1a93f2";
function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue({ id: userId });
  mocks.create.mockResolvedValue({ id: projectId });
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  mocks.getOwnedProject.mockResolvedValue({ id: projectId });
});

describe("project actions", () => {
  it("rejects blank names and oversized descriptions before writing", async () => {
    const state = await createProject({}, form({ name: "   ", description: "x".repeat(2001) }));
    expect(state.fieldErrors?.name).toHaveLength(1);
    expect(state.fieldErrors?.description).toHaveLength(1);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("uses the authenticated owner, ignoring submitted owner IDs", async () => {
    const state = await createProject({}, form({ name: "  My project  ", description: " Notes ", owner_id: "someone-else" }));
    expect(state.status).toBe("success");
    expect(mocks.create).toHaveBeenCalledWith({ data: { name: "My project", description: "Notes", owner_id: userId }, select: { id: true } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
  it("allows optional descriptions", async () => {
    await createProject({}, form({ name: "My project" }));
    expect(mocks.create.mock.calls[0][0].data.description).toBeNull();
  });
  it("handles create failures without revalidating", async () => {
    mocks.create.mockRejectedValue(new Error("database unavailable"));
    expect((await createProject({}, form({ name: "My project" }))).status).toBe("error");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it.each(["create", "delete"])("requires authentication before %s", async (mode) => {
    mocks.requireUser.mockRejectedValue(new Error("REDIRECT:/login"));
    const action = mode === "create" ? createProject : deleteProject;
    await expect(action({}, form({ name: "My project", project_id: projectId }))).rejects.toThrow("REDIRECT:/login");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
  it("rejects invalid project IDs", async () => {
    expect((await deleteProject({}, form({ project_id: "invalid" }))).status).toBe("error");
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
  it("scopes deletion by both project ID and owner ID", async () => {
    expect((await deleteProject({}, form({ project_id: projectId, owner_id: "someone-else" }))).status).toBe("success");
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: projectId, owner_id: userId } });
    expect(mocks.getOwnedProject).toHaveBeenCalledWith(projectId, userId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
  it("refuses deletion before mutation when ownership lookup fails", async () => {
    mocks.getOwnedProject.mockResolvedValue(null);
    expect((await deleteProject({}, form({ project_id: projectId }))).status).toBe("error");
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
  it("handles ownership lookup database failures", async () => {
    mocks.getOwnedProject.mockRejectedValue(new Error("database unavailable"));
    expect((await deleteProject({}, form({ project_id: projectId }))).status).toBe("error");
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
  it("refuses deletion when no owned project matched", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    expect((await deleteProject({}, form({ project_id: projectId }))).status).toBe("error");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("handles delete failures", async () => {
    mocks.deleteMany.mockRejectedValue(new Error("database unavailable"));
    expect((await deleteProject({}, form({ project_id: projectId }))).status).toBe("error");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
