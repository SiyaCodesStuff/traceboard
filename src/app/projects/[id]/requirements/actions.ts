"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { getOwnedProject } from "../../../../lib/project-access";
import { EntityType, requirementFormSchema, requirementEditFormSchema, requirementDeleteSchema, type RequirementActionState } from "../../../../lib/validators";

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function fields(form: FormData) {
  return { title: text(form, "title"), description: text(form, "description"), priority: text(form, "priority"), status: text(form, "status") };
}

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}/requirements`);
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/dashboard");
}

function failure(error: unknown): RequirementActionState {
  console.error("[Requirements] Write failed", { code: typeof error === "object" && error !== null && "code" in error ? error.code : "unknown" });
  return { status: "error", message: "Unable to save this change. Please try again." };
}

export async function createRequirement(_previous: RequirementActionState, form: FormData): Promise<RequirementActionState> {
  const user = await requireUser();
  const values = fields(form);
  const parsed = requirementFormSchema.safeParse({ ...values, project_id: text(form, "project_id") });
  if (!parsed.success) return { status: "error", message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors, values };
  const { project_id, ...data } = parsed.data;
  try {
    if (!await getOwnedProject(project_id, user.id)) return { status: "error", message: "Project not found or you do not have access.", values };
    const requirement = await db.$transaction(async (tx) => {
      // The atomic update locks this project's row until the insert commits or rolls back.
      const project = await tx.project.update({
        where: { id: project_id, owner_id: user.id },
        data: { req_seq: { increment: 1 } }, select: { req_seq: true },
      });
      return tx.requirement.create({
        data: { ...data, description: data.description || null, project_id, code: `REQ-${String(project.req_seq).padStart(3, "0")}` },
        select: { id: true, code: true },
      });
    });
    refresh(project_id);
    return { status: "success", message: `Requirement ${requirement.code} created.`, ...requirement };
  } catch (error) {
    return { ...failure(error), values };
  }
}

export async function updateRequirement(_previous: RequirementActionState, form: FormData): Promise<RequirementActionState> {
  const user = await requireUser();
  const values = fields(form);
  const parsed = requirementEditFormSchema.safeParse({ ...values, project_id: text(form, "project_id"), id: text(form, "id") });
  if (!parsed.success) return { status: "error", message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors, values };
  const { id, project_id, ...data } = parsed.data;
  try {
    if (!await getOwnedProject(project_id, user.id)) return { status: "error", message: "Project not found or you do not have access.", values };
    const result = await db.requirement.updateMany({
      where: { id, project_id, project: { owner_id: user.id } },
      data: { ...data, description: data.description || null },
    });
    if (!result.count) return { status: "error", message: "Requirement not found or you do not have access.", values };
    refresh(project_id);
    return { status: "success", message: "Requirement updated." };
  } catch (error) {
    return { ...failure(error), values };
  }
}

export async function deleteRequirement(_previous: RequirementActionState, form: FormData): Promise<RequirementActionState> {
  const user = await requireUser();
  const parsed = requirementDeleteSchema.safeParse({ id: text(form, "id"), project_id: text(form, "project_id") });
  if (!parsed.success) return { status: "error", message: "Invalid requirement or project ID." };
  const { id, project_id } = parsed.data;
  try {
    if (!await getOwnedProject(project_id, user.id)) return { status: "error", message: "Project not found or you do not have access." };
    const deleted = await db.$transaction(async (tx) => {
      const result = await tx.requirement.deleteMany({ where: { id, project_id, project: { owner_id: user.id } } });
      if (!result.count) return false;
      await tx.link.deleteMany({
        where: {
          project_id, project: { owner_id: user.id },
          OR: [{ source_type: EntityType.REQUIREMENT, source_id: id }, { target_type: EntityType.REQUIREMENT, target_id: id }],
        },
      });
      return true;
    });
    if (!deleted) return { status: "error", message: "Requirement not found or you do not have access." };
    refresh(project_id);
    return { status: "success", message: "Requirement deleted." };
  } catch (error) {
    return failure(error);
  }
}
