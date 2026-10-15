import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), findFirst: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("../lib/db", () => ({ db: { project: { findFirst: mocks.findFirst } } }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("../components/TraceMatrix", () => ({ TraceMatrix: () => null }));
import MatrixPage from "../app/projects/[id]/matrix/page";

const projectId = "a75b439b-4618-4edc-b7bd-a97a794367cb";
const userId = "c25f85a1-fd21-40ae-ae03-93b1dd1a93f2";
const data = {
  requirements: [{ id: "r1", code: "REQ-001", title: "Requirement" }],
  user_stories: [{ id: "s1" }],
  test_cases: [{ id: "t1", code: "TC-001", title: "Test" }],
  links: [
    { id: "l1", source_type: "REQUIREMENT", source_id: "r1", target_type: "USER_STORY", target_id: "s1" },
    { id: "l2", source_type: "USER_STORY", source_id: "s1", target_type: "TEST_CASE", target_id: "t1" },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue({ id: userId });
  mocks.findFirst.mockResolvedValueOnce({ id: projectId }).mockResolvedValueOnce(data);
});
async function render(id = projectId) {
  const page = MatrixPage({ params: Promise.resolve({ id }) });
  return page.props.children.type(page.props.children.props);
}

describe("matrix page data loading", () => {
  it("uses exactly two owner-scoped Prisma calls, including the shared ownership lookup", async () => {
    const view = await render();
    expect(mocks.findFirst).toHaveBeenCalledTimes(2);
    for (const [query] of mocks.findFirst.mock.calls) expect(query.where).toEqual({ id: projectId, owner_id: userId });
    expect(mocks.findFirst.mock.calls[1][0].select).toMatchObject({ requirements: {}, user_stories: {}, test_cases: {}, links: {} });
    expect(view.props.matrix.coverage.coveragePercentage).toBe(100);
    expect(view.props.matrix.rows[0].cells[0]).toMatchObject({ covered: true, viaStory: true, directLinkIds: [] });
  });
  it("returns not-found for an unowned or missing project without loading graph data", async () => {
    mocks.findFirst.mockReset().mockResolvedValueOnce(null);
    await expect(render()).rejects.toThrow();
    expect(mocks.findFirst).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed IDs before querying Prisma", async () => {
    await expect(render("invalid")).rejects.toThrow();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it("handles a project disappearing after the ownership lookup", async () => {
    mocks.findFirst.mockReset().mockResolvedValueOnce({ id: projectId }).mockResolvedValueOnce(null);
    await expect(render()).rejects.toThrow();
    expect(mocks.findFirst).toHaveBeenCalledTimes(2);
  });
});
