import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch as unstable_doesProxyMatch } from "next/experimental/testing/server";
import type { CookieMethodsServer } from "@supabase/ssr";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), getUser: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));
import { config, proxy } from "./proxy";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "dummy-publishable-key");
  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

const request = (path: string) => new NextRequest(`https://example.com${path}`);

describe("Supabase proxy", () => {
  it.each(["/dashboard", "/dashboard/settings", "/projects", "/projects/abc/tests"])(
    "redirects unauthenticated requests for %s", async (path) => {
      const response = await proxy(request(`${path}?old=1`));
      expect(response.headers.get("location")).toBe("https://example.com/login");
      expect(response.status).toBe(307);
    },
  );

  it.each(["/login", "/signup"])("redirects signed-in users from %s", async (path) => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
    expect((await proxy(request(path))).headers.get("location")).toBe("https://example.com/dashboard");
  });

  it.each(["/login", "/signup", "/auth/confirm", "/", "/projects-other", "/dashboard-other"])(
    "allows unauthenticated access to public route %s", async (path) => {
      expect((await proxy(request(path))).headers.get("location")).toBeNull();
    },
  );

  it("allows signed-in access to projects", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
    expect((await proxy(request("/projects/abc"))).headers.get("location")).toBeNull();
  });

  it("treats verification failures as unauthenticated", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { code: "session_not_found" } });
    expect((await proxy(request("/dashboard"))).headers.get("location")).toBe("https://example.com/login");
  });

  it.each([true, false])("preserves refreshed cookies and cache headers (redirect=%s)", async (redirect) => {
    const req = request(redirect ? "/login" : "/dashboard");
    mocks.createServerClient.mockImplementation((_url: string, _key: string, options: { cookies: CookieMethodsServer }) => ({
      auth: {
        getUser: async () => {
          expect(options.cookies.getAll()).toEqual([]);
          await options.cookies.setAll!([
            { name: "sb-test-auth-token", value: "refreshed", options: { path: "/", httpOnly: true, sameSite: "lax" } },
          ], { "Cache-Control": "private, no-store", Expires: "0", Pragma: "no-cache" });
          return { data: { user: { id: "user-a" } }, error: null };
        },
      },
    }));
    const response = await proxy(req);
    expect(req.cookies.get("sb-test-auth-token")?.value).toBe("refreshed");
    expect(response.cookies.get("sb-test-auth-token")).toMatchObject({ value: "refreshed", httpOnly: true, path: "/", sameSite: "lax" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it.each(["/_next/static/chunk.js", "/_next/image?url=test", "/favicon.ico", "/logo.svg", "/styles.css", "/script.js", "/font.woff2", "/robots.txt"])(
    "excludes static asset %s", (url) => {
      expect(unstable_doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
    },
  );

  it.each(["/login", "/signup", "/dashboard", "/projects/abc"])("matches %s", (url) => {
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
  });
});
