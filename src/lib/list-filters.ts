import { prioritySchema, requirementStatusSchema, testCaseStatusSchema } from "./validators";

export type ListSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseListFilters(params: ListSearchParams) {
  const priority = prioritySchema.safeParse(first(params.priority));
  const requirementStatus = requirementStatusSchema.safeParse(first(params.status));
  const testStatus = testCaseStatusSchema.safeParse(first(params.status));
  return {
    q: (first(params.q) ?? "").trim().slice(0, 200),
    priority: priority.success ? priority.data : undefined,
    requirementStatus: requirementStatus.success ? requirementStatus.data : undefined,
    testStatus: testStatus.success ? testStatus.data : undefined,
  };
}

export function titleCodeSearch(q: string) {
  return q ? { OR: [
    { title: { contains: q, mode: "insensitive" as const } },
    { code: { contains: q, mode: "insensitive" as const } },
  ] } : {};
}
