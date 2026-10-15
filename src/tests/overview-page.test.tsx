import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { calculateCoverage } from "../lib/coverage";
import { CoverageCard } from "../components/CoverageCard";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), findFirst: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("../lib/db", () => ({ db: { project: { findFirst: mocks.findFirst } } }));
vi.mock("next/server", () => ({ connection: async () => {} }));
import OverviewPage from "../app/projects/[id]/page";

const id = "a75b439b-4618-4edc-b7bd-a97a794367cb";
const item = (id: string, code: string) => ({ id, code, title: `Title ${code}` });
const data = {
  requirements: [item("r1", "REQ-001"), item("r2", "REQ-002")],
  user_stories: [item("s1", "US-001"), item("s2", "US-002")],
  test_cases: [item("t1", "TC-001"), item("t2", "TC-002")],
  links: [
    { source_type: "REQUIREMENT" as const, source_id: "r1", target_type: "USER_STORY" as const, target_id: "s1" },
    { source_type: "TEST_CASE" as const, source_id: "t1", target_type: "USER_STORY" as const, target_id: "s1" },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "owner" });
  mocks.findFirst.mockResolvedValueOnce({ id, _count: { requirements: 2, user_stories: 2, test_cases: 2, links: 2 } }).mockResolvedValueOnce(data);
});
async function render() {
  const page = OverviewPage({ params: Promise.resolve({ id }) });
  return page.props.children.type(page.props.children.props);
}

describe("overview coverage", () => {
  it("loads owner-scoped data and links only the gaps identified by shared coverage logic", async () => {
    const html = renderToStaticMarkup(await render());
    expect(mocks.findFirst).toHaveBeenCalledTimes(2);
    for (const [query] of mocks.findFirst.mock.calls) expect(query.where).toEqual({ id, owner_id: "owner" });
    expect(html).toContain("50%");
    for (const [path, code] of [["requirements", "REQ-002"], ["stories", "US-002"], ["tests", "TC-002"]]) {
      expect(html).toContain(`/projects/${id}/${path}?q=${code}`);
    }
    expect(html).not.toContain("?q=REQ-001");
    expect(html).not.toContain("?q=TC-001");
    expect(html).not.toContain("?q=US-001");
  });
  it("does not load graph data for an unowned project", async () => {
    mocks.findFirst.mockReset().mockResolvedValueOnce(null);
    await expect(render()).rejects.toThrow();
    expect(mocks.findFirst).toHaveBeenCalledTimes(1);
  });
  it("handles deletion between the ownership and graph queries", async () => {
    mocks.findFirst.mockReset().mockResolvedValueOnce({ id }).mockResolvedValueOnce(null);
    await expect(render()).rejects.toThrow();
  });
  it("shows zero coverage and clear empty lists for an empty project", async () => {
    mocks.findFirst.mockReset().mockResolvedValueOnce({ id, _count: {} }).mockResolvedValueOnce({ requirements: [], user_stories: [], test_cases: [], links: [] });
    const html = renderToStaticMarkup(await render());
    expect(html).toContain("0%");
    expect(html).toContain("No orphan tests.");
    expect(html).toContain("No stories without requirements.");
  });
  it("renders the exact percentage and gap counts from the supplied result", () => {
    const coverage = calculateCoverage({ requirements: data.requirements, userStories: data.user_stories, testCases: data.test_cases, links: data.links });
    const html = renderToStaticMarkup(<CoverageCard coverage={coverage} />);
    expect(html).toContain('value="50"');
    expect(html).toContain('max="100"');
    expect(html).toContain("1 of 2 requirements covered");
    expect(html.match(/>1<\/dd>/g)).toHaveLength(3);
  });
});
