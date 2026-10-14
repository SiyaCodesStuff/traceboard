import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(),
  signOut: vi.fn(), revalidatePath: vi.fn(), redirect: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { logIn, logOut, signUp } from "./actions";

function credentials(email = "tester@example.com", password = "valid-password") {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createClient.mockResolvedValue({ auth: mocks });
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`); });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("authentication actions", () => {
  it("rejects invalid fields before contacting Supabase and does not return passwords", async () => {
    const result = await signUp({}, credentials("invalid", "short"));
    expect(result.fieldErrors?.email).toHaveLength(1);
    expect(result.fieldErrors?.password).toHaveLength(1);
    expect(result).not.toHaveProperty("password");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("validates login fields too", async () => {
    expect((await logIn({}, credentials("", ""))).status).toBe("error");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("shows confirmation instructions when signup creates no session", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const result = await signUp({}, credentials());
    expect(result.status).toBe("confirmation");
    expect(result.message).toContain("confirmation email");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each(["signup", "login"])("redirects successful %s sessions without swallowing the redirect", async (mode) => {
    const method = mode === "signup" ? mocks.signUp : mocks.signInWithPassword;
    method.mockResolvedValue({ data: { session: {} }, error: null });
    const action = mode === "signup" ? signUp : logIn;
    await expect(action({}, credentials(" tester@example.com "))).rejects.toThrow("REDIRECT:/dashboard");
    expect(method).toHaveBeenCalledWith({ email: "tester@example.com", password: "valid-password" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("returns a safe login failure", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: { code: "invalid_credentials" } });
    expect((await logIn({}, credentials())).status).toBe("error");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("explains unconfirmed email failures", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: { code: "email_not_confirmed" } });
    expect((await logIn({}, credentials())).message).toContain("Confirm your email");
  });

  it.each([
    ["email_address_not_authorized", "custom SMTP"],
    ["over_email_send_rate_limit", "email limit"],
    ["signup_disabled", "disabled"],
  ])("explains signup failure %s and logs only diagnostic fields", async (code, message) => {
    mocks.signUp.mockResolvedValue({ data: {}, error: { code, status: 422, message: "Private provider details" } });
    const result = await signUp({}, credentials());
    expect(result.message).toContain(message);
    expect(console.error).toHaveBeenCalledWith("[Supabase Auth] Authentication failed", {
      operation: "signup", code, status: 422,
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("shows stronger password requirements next to the password field", async () => {
    mocks.signUp.mockResolvedValue({ data: {}, error: { code: "weak_password", status: 422 } });
    const result = await signUp({}, credentials());
    expect(result.fieldErrors?.password?.[0]).toContain("stronger password");
  });

  it("handles unavailable auth services", async () => {
    mocks.createClient.mockRejectedValue(new Error("network unavailable"));
    expect((await logIn({}, credentials())).status).toBe("error");
  });

  it("logs out only the current session and redirects to login", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    await expect(logOut()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("keeps logout failures visible without redirecting", async () => {
    mocks.signOut.mockResolvedValue({ error: { message: "unavailable" } });
    expect((await logOut()).status).toBe("error");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
