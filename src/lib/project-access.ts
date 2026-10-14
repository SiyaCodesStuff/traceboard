import "server-only";
import { cache } from "react";
import { db } from "./db";
import { projectIdSchema } from "./validators";

// React cache deduplicates layout/page reads within a render, not across users.
export const getOwnedProject = cache(async (projectId: string, userId: string) => {
  const parsed = projectIdSchema.safeParse(projectId);
  if (!parsed.success) return null;
  return db.project.findFirst({
    where: { id: parsed.data, owner_id: userId },
    include: { _count: { select: { requirements: true, user_stories: true, test_cases: true, links: true } } },
  });
});
