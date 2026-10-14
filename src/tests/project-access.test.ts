import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../lib/db", () => ({ db: { project: { findFirst: mocks.findFirst } } }));
import { getOwnedProject } from "../lib/project-access";

const id = "c25f85a1-fd21-40ae-ae03-93b1dd1a93f2";
const userId = "a75b439b-4618-4edc-b7bd-a97a794367cb";
beforeEach(() => vi.resetAllMocks());

describe("project ownership lookup", () => {
  it("scopes the query to both project and user, including item counts", async () => {
    const project = { id, owner_id: userId };
    mocks.findFirst.mockResolvedValue(project);
    expect(await getOwnedProject(id, userId)).toBe(project);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id, owner_id: userId },
      include: { _count: { select: { requirements: true, user_stories: true, test_cases: true, links: true } } },
    });
  });
  it.each(["", "invalid", "1' OR 1=1"])("rejects malformed IDs before querying: %s", async (invalidId) => {
    expect(await getOwnedProject(invalidId, userId)).toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it("returns null for missing and unowned projects", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect(await getOwnedProject(id, userId)).toBeNull();
  });
});
