import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("create and link a requirement and test case with full coverage", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) throw new Error("Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to a dedicated, confirmed test account.");
  const mode = process.env.E2E_AUTH_MODE || "login";
  if (mode !== "login" && mode !== "signup") throw new Error("E2E_AUTH_MODE must be login or signup.");
  const projectName = `E2E traceability ${randomUUID()}`;
  let projectCreated = false;

  await page.goto(mode === "signup" ? "/signup" : "/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: mode === "signup" ? "Create account" : "Log in", exact: true }).click();
  if (mode === "signup") {
    await expect(page.getByText("Confirm your email", { exact: true }).or(page.getByRole("heading", { name: "Your projects", exact: true }))).toBeVisible();
    if (await page.getByText("Confirm your email", { exact: true }).isVisible()) {
      throw new Error("Signup requires email confirmation. Confirm the account, then rerun with E2E_AUTH_MODE=login.");
    }
  }
  await expect(page).toHaveURL(/\/dashboard$/);

  try {
    await page.getByRole("button", { name: "New project", exact: true }).click();
    const projectDialog = page.getByRole("dialog", { name: "New project", exact: true });
    await projectDialog.getByLabel("Name", { exact: true }).fill(projectName);
    await projectDialog.getByRole("button", { name: "Create project", exact: true }).click();
    await expect(projectDialog).toBeHidden();
    projectCreated = true;
    await page.getByRole("link", { name: projectName, exact: true }).click();
    await expect(page.getByRole("heading", { name: projectName, exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Requirements", exact: true }).click();
    await page.getByRole("button", { name: "New requirement", exact: true }).click();
    const requirementDialog = page.getByRole("dialog", { name: "New requirement", exact: true });
    await requirementDialog.getByLabel("Title", { exact: true }).fill("E2E requirement");
    await requirementDialog.getByRole("button", { name: "Create requirement", exact: true }).click();
    await expect(requirementDialog).toBeHidden();
    await expect(page.getByRole("row").filter({ hasText: "E2E requirement" })).toContainText("REQ-001");

    await page.getByRole("link", { name: "Tests", exact: true }).click();
    await page.getByRole("button", { name: "New test case", exact: true }).click();
    const testDialog = page.getByRole("dialog", { name: "New test case", exact: true });
    await testDialog.getByLabel("Title", { exact: true }).fill("E2E test case");
    await testDialog.getByLabel("Steps", { exact: true }).fill("Open the project and verify the requirement.");
    await testDialog.getByLabel("Expected result", { exact: true }).fill("The requirement is satisfied.");
    await testDialog.getByLabel("Status", { exact: true }).selectOption("PASSED");
    await testDialog.getByRole("button", { name: "Create test case", exact: true }).click();
    await expect(testDialog).toBeHidden();
    await expect(page.getByRole("row").filter({ hasText: "E2E test case" })).toContainText("TC-001");

    await page.getByRole("button", { name: "Links for TC-001", exact: true }).click();
    const links = page.getByRole("dialog", { name: "Links for TC-001", exact: true });
    await links.getByLabel("Add links", { exact: true }).fill("REQ-001");
    await links.getByRole("checkbox", { name: /REQ-001/ }).check();
    await links.getByRole("button", { name: "Add selected (1)", exact: true }).click();
    await expect(links.getByRole("button", { name: "Remove link to REQ-001", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(links).toBeHidden();

    await page.getByRole("link", { name: "Matrix", exact: true }).click();
    const cell = page.getByRole("button", { name: "Unlink REQ-001 from TC-001", exact: true });
    await expect(cell).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("dl > div").filter({ has: page.locator("dt", { hasText: /^Coverage$/ }) }).locator("dd")).toHaveText("100%");
    await expect(page.locator('tr[data-uncovered="true"]')).toHaveCount(0);

    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await expect(page.getByRole("progressbar", { name: "Requirement coverage", exact: true })).toHaveAttribute("value", "100");
  } finally {
    if (projectCreated) {
      await page.goto("/dashboard");
      await page.getByRole("button", { name: `Delete ${projectName}`, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Delete project?", exact: true });
      await dialog.getByRole("button", { name: "Delete project", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("link", { name: projectName, exact: true })).toHaveCount(0);
    }
  }
});
