"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { getOwnedProject } from "../../../../lib/project-access";
import { EntityType, userStoryFormSchema, userStoryEditFormSchema, userStoryDeleteSchema, type UserStoryActionState } from "../../../../lib/validators";

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function fields(form: FormData) {
  return { title: text(form, "title"), as_a: text(form, "as_a"), i_want: text(form, "i_want"), so_that: text(form, "so_that") };
}

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}/stories`);
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/dashboard");
}

function failure(error: unknown): UserStoryActionState {
  console.error("[Stories] Write failed", { code: typeof error === "object" && error !== null && "code" in error ? error.code : "unknown" });
  return { status: "error", message: "Unable to save this change. Please try again." };
}

export async function createUserStory(_previous: UserStoryActionState, form: FormData): Promise<UserStoryActionState> {
  const user = await requireUser();
  const values = fields(form);
  const parsed = userStoryFormSchema.safeParse({ ...values, project_id: text(form, "project_id") });
  if (!parsed.success) return { status: "error", message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors, values };
  const { project_id, ...data } = parsed.data;
  try {
    if (!await getOwnedProject(project_id, user.id)) return { status: "error", message: "Project not found or you do not have access.", values };
    const story = await db.$transaction(async (tx) => {
      // Lock the project counter until the story insert commits or rolls back.
      const project = await tx.project.update({
        where: { id: project_id, owner_id: user.id },
        data: { story_seq: { increment: 1 } }, select: { story_seq: true },
      });
      return tx.userStory.create({
        data: { ...data, project_id, code: `US-${String(project.story_seq).padStart(3, "0")}` },
        select: { id: true, code: true },
      });
    });
    refresh(project_id);
    return { status: "success", message: `Story ${story.code} created.`, ...story };
  } catch (error) {
    return { ...failure(error), values };
  }
}

export async function updateUserStory(_previous: UserStoryActionState, form: FormData): Promise<UserStoryActionState> {
  const user = await requireUser();
  const values = fields(form);
  const parsed = userStoryEditFormSchema.safeParse({ ...values, project_id: text(form, "project_id"), id: text(form, "id") });
  if (!parsed.success) return { status: "error", message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors, values };
  const { id, project_id, ...data } = parsed.data;
  try {
    if (!await getOwnedProject(project_id, user.id)) return { status: "error", message: "Project not found or you do not have access.", values };
    const result = await db.userStory.updateMany({ where: { id, project_id, project: { owner_id: user.id } }, data });
    if (!result.count) return { status: "error", message: "Story not found or you do not have access.", values };
    refresh(project_id);
    return { status: "success", message: "Story updated." };
  } catch (error) {
    return { ...failure(error), values };
  }
}

export async function deleteUserStory(_previous: UserStoryActionState, form: FormData): Promise<UserStoryActionState> {
  const user = await requireUser();
  const parsed = userStoryDeleteSchema.safeParse({ id: text(form, "id"), project_id: text(form, "project_id") });
  if (!parsed.success) return { status: "error", message: "Invalid story or project ID." };
  const { id, project_id } = parsed.data;
  try {
    if (!await getOwnedProject(project_id, user.id)) return { status: "error", message: "Project not found or you do not have access." };
    const deleted = await db.$transaction(async (tx) => {
      const result = await tx.userStory.deleteMany({ where: { id, project_id, project: { owner_id: user.id } } });
      if (!result.count) return false;
      await tx.link.deleteMany({
        where: {
          project_id, project: { owner_id: user.id },
          OR: [{ source_type: EntityType.USER_STORY, source_id: id }, { target_type: EntityType.USER_STORY, target_id: id }],
        },
      });
      return true;
    });
    if (!deleted) return { status: "error", message: "Story not found or you do not have access." };
    refresh(project_id);
    return { status: "success", message: "Story deleted." };
  } catch (error) {
    return failure(error);
  }
}
