import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), create: vi.fn(), lock: vi.fn(), disconnect: vi.fn(), transaction: vi.fn() }));
vi.mock("dotenv", () => ({ config: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: class {} }));
vi.mock("../generated/prisma/client", () => ({ PrismaClient: class {
  $transaction = mocks.transaction;
  $disconnect = mocks.disconnect;
} }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("SEED_USER_ID", "a75b439b-4618-4edc-b7bd-a97a794367cb");
  vi.stubEnv("DIRECT_URL", "postgresql://test:test@localhost/test");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.transaction.mockImplementation(async (callback) => callback({ $queryRaw: mocks.lock, project: { findUnique: mocks.findUnique, create: mocks.create } }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); process.exitCode = 0; });

async function run() {
  await import("../../prisma/seed");
  await vi.waitFor(() => expect(mocks.disconnect).toHaveBeenCalled());
}
describe("seed runner", () => {
  it("creates the entire demo atomically and skips it on a repeated run", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);
    await run();
    expect(mocks.lock).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.owner_id).toBe(process.env.SEED_USER_ID);
    expect(data.requirements.create).toHaveLength(8);
    expect(data.links.create).toHaveLength(14);
    vi.resetModules();
    mocks.disconnect.mockClear();
    mocks.findUnique.mockResolvedValueOnce({ owner_id: data.owner_id });
    await run();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenLastCalledWith("Online Banking App already exists; no data changed.");
  });
  it("rejects ownership changes without modifying data", async () => {
    mocks.findUnique.mockResolvedValueOnce({ owner_id: "another-user" });
    await run();
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
