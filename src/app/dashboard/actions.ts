"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../lib/auth";
import { db } from "../../lib/db";
import { getOwnedProject } from "../../lib/project-access";
import { projectSchema, projectIdSchema, type ProjectActionState } from "../../lib/validators";

export async function createProject(_previousState: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const user = await requireUser();
  const values = {
    name: typeof formData.get("name") === "string" ? String(formData.get("name")) : "",
    description: typeof formData.get("description") === "string" ? String(formData.get("description")) : "",
  };
  const parsed = projectSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors, values };
  }
  try {
    await db.project.create({
      data: { name: parsed.data.name, description: parsed.data.description || null, owner_id: user.id },
      select: { id: true },
    });
  } catch {
    return { status: "error", message: "Unable to create your project. Please try again.", values };
  }
  revalidatePath("/dashboard");
  return { status: "success", message: "Project created." };
}

export async function deleteProject(_previousState: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const user = await requireUser();
  const parsed = projectIdSchema.safeParse(formData.get("project_id"));
  if (!parsed.success) return { status: "error", message: "Invalid project ID." };
  try {
    const project = await getOwnedProject(parsed.data, user.id);
    if (!project) return { status: "error", message: "Project not found or you do not have access." };
    const result = await db.project.deleteMany({ where: { id: parsed.data, owner_id: user.id } });
    if (result.count === 0) return { status: "error", message: "Project not found or you do not have access." };
  } catch {
    return { status: "error", message: "Unable to delete your project. Please try again." };
  }
  revalidatePath("/dashboard");
  return { status: "success", message: "Project deleted." };
}
