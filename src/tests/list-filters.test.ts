import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseListFilters, titleCodeSearch } from "../lib/list-filters";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), getOwnedProject: vi.fn(), requirements: vi.fn(), stories: vi.fn(), tests: vi.fn(), links: vi.fn() }));
vi.mock("../lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("../lib/project-access", () => ({ getOwnedProject: mocks.getOwnedProject }));
vi.mock("../lib/db", () => ({ db: { requirement: { findMany: mocks.requirements }, userStory: { findMany: mocks.stories }, testCase: { findMany: mocks.tests }, link: { findMany: mocks.links } } }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("../components/RequirementDialogs", () => ({ RequirementDialog: () => null, DeleteRequirementDialog: () => null }));
vi.mock("../components/UserStoryDialogs", () => ({ UserStoryDialog: () => null, DeleteUserStoryDialog: () => null }));
vi.mock("../components/TestCaseDialogs", () => ({ TestCaseDialog: () => null, DeleteTestCaseDialog: () => null }));
vi.mock("../components/ListFilters", () => ({ ListFilters: () => null }));
vi.mock("../components/LinkPicker", () => ({ LinkPicker: () => null }));
import RequirementsPage from "../app/projects/[id]/requirements/page";
import StoriesPage from "../app/projects/[id]/stories/page";
import TestsPage from "../app/projects/[id]/tests/page";

describe("URL filter parsing", () => {
  it("trims search and validates requirement enums", () => {
    expect(parseListFilters({ q: " REQ-001 ", priority: "HIGH", status: "APPROVED" })).toEqual({ q: "REQ-001", priority: "HIGH", requirementStatus: "APPROVED", testStatus: undefined });
  });
  it.each(["NOT_RUN", "PASSED", "FAILED"])("accepts test status %s", (status) => {
    const filters = parseListFilters({ status });
    expect(filters.testStatus).toBe(status);
    expect(filters.requirementStatus).toBeUndefined();
  });
  it("ignores invalid enum values and absent searches", () => {
    expect(parseListFilters({ priority: "URGENT", status: "INVALID" })).toEqual({ q: "", priority: undefined, requirementStatus: undefined, testStatus: undefined });
  });
  it("uses the first repeated parameter and bounds query length", () => {
    expect(parseListFilters({ q: [" first ", "second"], priority: ["LOW", "HIGH"] })).toMatchObject({ q: "first", priority: "LOW" });
    expect(parseListFilters({ q: "x".repeat(201) }).q).toHaveLength(200);
    expect(parseListFilters({ q: [] }).q).toBe("");
  });
  it("searches title or code case-insensitively", () => {
    expect(titleCodeSearch("search")).toEqual({ OR: [{ title: { contains: "search", mode: "insensitive" } }, { code: { contains: "search", mode: "insensitive" } }] });
    expect(titleCodeSearch("")).toEqual({});
  });
});

const projectId = "a75b439b-4618-4edc-b7bd-a97a794367cb";
const userId = "c25f85a1-fd21-40ae-ae03-93b1dd1a93f2";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue({ id: userId });
  mocks.getOwnedProject.mockResolvedValue({ id: projectId });
  for (const mock of [mocks.requirements, mocks.stories, mocks.tests, mocks.links]) mock.mockResolvedValue([]);
});

describe("server-side list queries", () => {
  it("combines requirement search, priority, and status without leaking them into linked-test queries", async () => {
    const page = RequirementsPage({ params: Promise.resolve({ id: projectId }), searchParams: Promise.resolve({ q: " alpha ", priority: "HIGH", status: "DRAFT", owner_id: "forged" }) });
    await page.props.children.type(page.props.children.props);
    expect(mocks.requirements.mock.calls[0][0].where).toEqual({ project_id: projectId, project: { owner_id: userId }, ...titleCodeSearch("alpha"), priority: "HIGH", status: "DRAFT" });
    expect(mocks.tests.mock.calls[0][0].where).toEqual({ project_id: projectId, project: { owner_id: userId } });
    expect(mocks.getOwnedProject).toHaveBeenCalledWith(projectId, userId);
  });
  it("searches stories by title/code and ignores unsupported enum filters", async () => {
    const page = StoriesPage({ params: Promise.resolve({ id: projectId }), searchParams: Promise.resolve({ q: "US-001", priority: "HIGH", status: "DRAFT" }) });
    await page.props.children.type(page.props.children.props);
    expect(mocks.stories.mock.calls[0][0].where).toEqual({ project_id: projectId, project: { owner_id: userId }, ...titleCodeSearch("US-001") });
  });
  it("searches tests and applies a validated status in Prisma", async () => {
    const page = TestsPage({ params: Promise.resolve({ id: projectId }), searchParams: Promise.resolve({ q: "TC-001", status: "FAILED" }) });
    await page.props.children.type(page.props.children.props);
    expect(mocks.tests.mock.calls[0][0].where).toEqual({ project_id: projectId, project: { owner_id: userId }, ...titleCodeSearch("TC-001"), status: "FAILED" });
  });
  it("does not pass invalid status values into Prisma", async () => {
    const page = TestsPage({ params: Promise.resolve({ id: projectId }), searchParams: Promise.resolve({ status: "APPROVED" }) });
    await page.props.children.type(page.props.children.props);
    expect(mocks.tests.mock.calls[0][0].where.status).toBeUndefined();
  });
});
