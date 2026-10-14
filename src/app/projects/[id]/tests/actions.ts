"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { getOwnedProject } from "../../../../lib/project-access";
import { EntityType, testCaseFormSchema, testCaseEditFormSchema, testCaseDeleteSchema, type TestCaseActionState } from "../../../../lib/validators";

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function fields(form: FormData) {
  return { title: text(form, "title"), steps: text(form, "steps"), expected_result: text(form, "expected_result"), status: text(form, "status") };
}

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}/tests`);
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/dashboard");
}

function failure(error: unknown): TestCaseActionState {
  console.error("[Tests] Write failed", { code: typeof error === "object" && error !== null && "code" in error ? error.code : "unknown" });
  return { status: "error", message: "Unable to save this change. Please try again." };
}

export async function createTestCase(_previous: TestCaseActionState, form: FormData): Promise<TestCaseActionState> {
  const user = await requireUser();
  const values = fields(form);
  const parsed = testCaseFormSchema.safeParse({ ...values, project_id: text(form, "project_id") });
  if (!parsed.success) return { status: "error", message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors, values };
  const { project_id, ...data } = parsed.data;
  try {
    if (!await getOwnedProject(project_id, user.id)) return { status: "error", message: "Project not found or you do not have access.", values };
    const testCase = await db.$transaction(async (tx) => {
      // Lock the project counter until the test case insert commits or rolls back.
      const project = await tx.project.update({
        where: { id: project_id, owner_id: user.id },
        data: { test_seq: { increment: 1 } }, select: { test_seq: true },
      });
      return tx.testCase.create({
        data: { ...data, project_id, code: `TC-${String(project.test_seq).padStart(3, "0")}` },
        select: { id: true, code: true },
      });
    });
    refresh(project_id);
    return { status: "success", message: `Test case ${testCase.code} created.`, ...testCase };
  } catch (error) {
    return { ...failure(error), values };
  }
}

export async function updateTestCase(_previous: TestCaseActionState, form: FormData): Promise<TestCaseActionState> {
  const user = await requireUser();
  const values = fields(form);
  const parsed = testCaseEditFormSchema.safeParse({ ...values, project_id: text(form, "project_id"), id: text(form, "id") });
  if (!parsed.success) return { status: "error", message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors, values };
  const { id, project_id, ...data } = parsed.data;
  try {
    if (!await getOwnedProject(project_id, user.id)) return { status: "error", message: "Project not found or you do not have access.", values };
    const result = await db.testCase.updateMany({ where: { id, project_id, project: { owner_id: user.id } }, data });
    if (!result.count) return { status: "error", message: "Test case not found or you do not have access.", values };
    refresh(project_id);
    return { status: "success", message: "Test case updated." };
  } catch (error) {
    return { ...failure(error), values };
  }
}

export async function deleteTestCase(_previous: TestCaseActionState, form: FormData): Promise<TestCaseActionState> {
  const user = await requireUser();
  const parsed = testCaseDeleteSchema.safeParse({ id: text(form, "id"), project_id: text(form, "project_id") });
  if (!parsed.success) return { status: "error", message: "Invalid test case or project ID." };
  const { id, project_id } = parsed.data;
  try {
    if (!await getOwnedProject(project_id, user.id)) return { status: "error", message: "Project not found or you do not have access." };
    const deleted = await db.$transaction(async (tx) => {
      const result = await tx.testCase.deleteMany({ where: { id, project_id, project: { owner_id: user.id } } });
      if (!result.count) return false;
      await tx.link.deleteMany({
        where: {
          project_id, project: { owner_id: user.id },
          OR: [{ source_type: EntityType.TEST_CASE, source_id: id }, { target_type: EntityType.TEST_CASE, target_id: id }],
        },
      });
      return true;
    });
    if (!deleted) return { status: "error", message: "Test case not found or you do not have access." };
    refresh(project_id);
    return { status: "success", message: "Test case deleted." };
  } catch (error) {
    return failure(error);
  }
}
