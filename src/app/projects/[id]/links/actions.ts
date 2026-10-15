"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "../../../../generated/prisma/client";
import { requireUser } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { getOwnedProject } from "../../../../lib/project-access";
import { EntityType, linkCreateSchema, linkDeleteSchema, linkPickerSchema } from "../../../../lib/validators";
import type { LinkActionState, LinkItem, LinkPickerResult } from "../../../../lib/link-types";

function input(form: FormData) {
  return Object.fromEntries(form.entries());
}

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/dashboard");
}

// Row locks protect both endpoint existence and duplicate checks until commit.
async function lockProject(tx: Prisma.TransactionClient, projectId: string, userId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM public."Project" WHERE id = ${projectId}::uuid AND owner_id = ${userId}::uuid FOR UPDATE`;
  return rows.length > 0;
}

async function lockItem(tx: Prisma.TransactionClient, type: EntityType, id: string, projectId: string) {
  let rows: { id: string }[];
  switch (type) {
    case EntityType.REQUIREMENT:
      rows = await tx.$queryRaw`SELECT id FROM public."Requirement" WHERE id = ${id}::uuid AND project_id = ${projectId}::uuid FOR UPDATE`;
      break;
    case EntityType.USER_STORY:
      rows = await tx.$queryRaw`SELECT id FROM public."UserStory" WHERE id = ${id}::uuid AND project_id = ${projectId}::uuid FOR UPDATE`;
      break;
    case EntityType.TEST_CASE:
      rows = await tx.$queryRaw`SELECT id FROM public."TestCase" WHERE id = ${id}::uuid AND project_id = ${projectId}::uuid FOR UPDATE`;
  }
  return rows.length > 0;
}

function failure(error: unknown): LinkActionState {
  console.error("[Links] Write failed", { code: typeof error === "object" && error !== null && "code" in error ? error.code : "unknown" });
  return { status: "error", message: "Unable to save this link. Please try again." };
}

export async function createLink(_previous: LinkActionState, form: FormData): Promise<LinkActionState> {
  const user = await requireUser();
  const parsed = linkCreateSchema.safeParse(input(form));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const link = parsed.data;
  try {
    if (!await getOwnedProject(link.project_id, user.id)) return { status: "error", message: "Project not found or you do not have access." };
    const result: LinkActionState = await db.$transaction(async (tx) => {
      if (!await lockProject(tx, link.project_id, user.id)) return { status: "error", message: "Project not found or you do not have access." };
      if (!await lockItem(tx, link.source_type, link.source_id, link.project_id) || !await lockItem(tx, link.target_type, link.target_id, link.project_id)) {
        return { status: "error", message: "Both items must exist in this project." };
      }
      const duplicate = await tx.link.findFirst({ where: {
        project_id: link.project_id, project: { owner_id: user.id }, OR: [
          { source_type: link.source_type, source_id: link.source_id, target_type: link.target_type, target_id: link.target_id },
          { source_type: link.target_type, source_id: link.target_id, target_type: link.source_type, target_id: link.source_id },
        ],
      }, select: { id: true } });
      if (duplicate) return { status: "error", message: "These items are already linked." };
      const created = await tx.link.create({ data: link, select: { id: true } });
      return { status: "success", message: "Link added.", id: created.id };
    });
    if (result.status === "success") refresh(link.project_id);
    return result;
  } catch (error) { return failure(error); }
}

export async function deleteLink(_previous: LinkActionState, form: FormData): Promise<LinkActionState> {
  const user = await requireUser();
  const parsed = linkDeleteSchema.safeParse(input(form));
  if (!parsed.success) return { status: "error", message: "Invalid link or project ID." };
  const { id, project_id } = parsed.data;
  try {
    if (!await getOwnedProject(project_id, user.id)) return { status: "error", message: "Project not found or you do not have access." };
    const result: LinkActionState = await db.$transaction(async (tx) => {
      if (!await lockProject(tx, project_id, user.id)) return { status: "error", message: "Project not found or you do not have access." };
      const link = await tx.link.findFirst({ where: { id, project_id, project: { owner_id: user.id } } });
      if (!link) return { status: "error", message: "Link not found or you do not have access." };
      if (!await lockItem(tx, link.source_type, link.source_id, project_id) || !await lockItem(tx, link.target_type, link.target_id, project_id)) {
        return { status: "error", message: "Both items must exist in this project." };
      }
      const deleted = await tx.link.deleteMany({ where: { id, project_id, project: { owner_id: user.id } } });
      return deleted.count ? { status: "success", message: "Link removed." } : { status: "error", message: "Link no longer exists." };
    });
    if (result.status === "success") refresh(project_id);
    return result;
  } catch (error) { return failure(error); }
}

export async function getLinkOptions(form: FormData): Promise<LinkPickerResult> {
  const user = await requireUser();
  const parsed = linkPickerSchema.safeParse(input(form));
  if (!parsed.success) return { error: "Invalid item or project ID." };
  const { project_id, source_type, source_id } = parsed.data;
  try {
    if (!await getOwnedProject(project_id, user.id)) return { error: "Project not found or you do not have access." };
    const where = { project_id, project: { owner_id: user.id } };
    const select = { id: true, code: true, title: true };
    const [requirements, stories, tests, links] = await Promise.all([
      db.requirement.findMany({ where, select, orderBy: { code: "asc" } }),
      db.userStory.findMany({ where, select, orderBy: { code: "asc" } }),
      db.testCase.findMany({ where, select, orderBy: { code: "asc" } }),
      db.link.findMany({ where: { ...where, OR: [{ source_type, source_id }, { target_type: source_type, target_id: source_id }] } }),
    ]);
    const items: LinkItem[] = [
      ...requirements.map((item) => ({ ...item, type: EntityType.REQUIREMENT })),
      ...stories.map((item) => ({ ...item, type: EntityType.USER_STORY })),
      ...tests.map((item) => ({ ...item, type: EntityType.TEST_CASE })),
    ];
    const key = (type: EntityType, id: string) => `${type}:${id}`;
    const byId = new Map(items.map((item) => [key(item.type, item.id), item]));
    if (!byId.has(key(source_type, source_id))) return { error: "Item not found in this project." };
    const current = links.flatMap((link) => {
      const item = link.source_type === source_type && link.source_id === source_id
        ? byId.get(key(link.target_type, link.target_id)) : byId.get(key(link.source_type, link.source_id));
      return item ? [{ id: link.id, item }] : [];
    });
    const linked = new Set(current.map(({ item }) => key(item.type, item.id)));
    return { data: { current, options: items.filter((item) => item.type !== source_type && item.id !== source_id && !linked.has(key(item.type, item.id))) } };
  } catch { return { error: "Unable to load links. Please try again." }; }
}
