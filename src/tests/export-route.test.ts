import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getOwnedProject: vi.fn(), findFirst: vi.fn() }));
vi.mock("../lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("../lib/project-access", () => ({ getOwnedProject: mocks.getOwnedProject }));
vi.mock("../lib/db", () => ({ db: { project: { findFirst: mocks.findFirst } } }));
import { GET } from "../app/api/export/route";

const id = "a75b439b-4618-4edc-b7bd-a97a794367cb";
const request = (query = `projectId=${id}`) => new Request(`http://localhost/api/export?${query}`);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "owner" });
  mocks.getOwnedProject.mockResolvedValue({ id });
  mocks.findFirst.mockResolvedValue({ requirements: [], user_stories: [], test_cases: [], links: [] });
});
describe("CSV export route", () => {
  it("requires a verified user before reading project data", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect(mocks.getOwnedProject).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it.each(["", "projectId=invalid"])("rejects missing or invalid IDs: %s", async (query) => {
    expect((await GET(request(query))).status).toBe(400);
    expect(mocks.getOwnedProject).not.toHaveBeenCalled();
  });
  it("does not reveal or load an unowned project", async () => {
    mocks.getOwnedProject.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(404);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it("scopes the export query to the owner and returns a noncached attachment", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.getOwnedProject).toHaveBeenCalledWith(id, "owner");
    expect(mocks.findFirst.mock.calls[0][0].where).toEqual({ id, owner_id: "owner" });
    expect(response.headers.get("Content-Disposition")).toBe(`attachment; filename="traceability-${id}.csv"`);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).toContain('"Linked test codes","Coverage"');
  });
  it("handles deletion after ownership verification", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(404);
  });
});
