import { describe, expect, it } from "vitest";
import {
  EntityType, Priority, RequirementStatus, TestCaseStatus,
  entityTypeSchema, prioritySchema, requirementStatusSchema, testCaseStatusSchema,
  projectCreateSchema, projectUpdateSchema, requirementCreateSchema, requirementUpdateSchema,
  userStorySchema, testCaseSchema, linkCreateSchema, linkDeleteSchema,
} from "../lib/validators";

const projectId = "a75b439b-4618-4edc-b7bd-a97a794367cb";
const id = "c25f85a1-fd21-40ae-ae03-93b1dd1a93f2";
const targetId = "3f23afc1-0e50-49a1-9a8e-556c3af9a424";
const requirement = { project_id: projectId, code: "REQ-1", title: "A requirement", priority: Priority.MEDIUM, status: RequirementStatus.DRAFT };
const story = { project_id: projectId, code: "STORY-1", title: "A story", as_a: "tester", i_want: "validation", so_that: "data is consistent" };
const testCase = { project_id: projectId, code: "TEST-1", title: "A test", steps: "Submit the form", expected_result: "It succeeds", status: TestCaseStatus.NOT_RUN };
const link = { project_id: projectId, source_type: EntityType.REQUIREMENT, source_id: id, target_type: EntityType.TEST_CASE, target_id: targetId };

describe("project create", () => {
  it("trims text and allows omitted or nullable descriptions", () => {
    expect(projectCreateSchema.parse({ name: "  Project  ", description: "  Notes  " })).toEqual({ name: "Project", description: "Notes" });
    expect(projectCreateSchema.safeParse({ name: "Project" }).success).toBe(true);
    expect(projectCreateSchema.safeParse({ name: "Project", description: null }).success).toBe(true);
  });
  it.each([{}, { name: "   " }, { name: 42 }, { name: "x".repeat(121) }, { name: "Project", description: "x".repeat(2001) }])("rejects invalid input %#", (input) => {
    expect(projectCreateSchema.safeParse(input).success).toBe(false);
  });
  it("accepts exact length boundaries and strips server-controlled metadata", () => {
    const parsed = projectCreateSchema.parse({ name: "x".repeat(120), description: "x".repeat(2000), owner_id: id, req_seq: 10, created_at: "forged" });
    expect(parsed).not.toHaveProperty("owner_id");
    expect(parsed).not.toHaveProperty("req_seq");
    expect(parsed).not.toHaveProperty("created_at");
  });
});

describe("project update", () => {
  it("accepts partial changes and clearing descriptions", () => {
    expect(projectUpdateSchema.parse({ id: ` ${id} `, name: " Changed " })).toEqual({ id, name: "Changed" });
    expect(projectUpdateSchema.safeParse({ id, description: null }).success).toBe(true);
    expect(projectUpdateSchema.safeParse({ id, description: "" }).success).toBe(true);
  });
  it.each([{ name: "Changed" }, { id: "invalid", name: "Changed" }, { id }, { id, name: undefined }, { id, name: " " }, { id, owner_id: targetId }, { id, name: "x".repeat(121) }])("rejects invalid or empty updates %#", (input) => {
    expect(projectUpdateSchema.safeParse(input).success).toBe(false);
  });
});

describe("requirement create", () => {
  it("validates and trims all text", () => {
    expect(requirementCreateSchema.parse({ ...requirement, project_id: ` ${projectId} `, code: " REQ-1 ", title: " A requirement ", description: " Notes " })).toEqual({ ...requirement, description: "Notes" });
  });
  it.each([
    { project_id: "invalid" }, { code: " " }, { code: "x".repeat(41) },
    { title: " " }, { title: "x".repeat(201) }, { description: "x".repeat(2001) },
    { priority: "URGENT" }, { status: "PASSED" }, { status: undefined },
  ])("rejects invalid requirement fields %#", (patch) => {
    expect(requirementCreateSchema.safeParse({ ...requirement, ...patch }).success).toBe(false);
  });
});

describe("requirement update", () => {
  it("accepts partial status changes and nullable descriptions", () => {
    expect(requirementUpdateSchema.safeParse({ id, project_id: projectId, status: RequirementStatus.APPROVED }).success).toBe(true);
    expect(requirementUpdateSchema.safeParse({ id, project_id: projectId, description: null }).success).toBe(true);
  });
  it.each([
    { project_id: projectId, title: "Changed" }, { id, title: "Changed" },
    { id, project_id: projectId }, { id, project_id: projectId, priority: "urgent" },
    { id, project_id: "invalid", title: "Changed" }, { id, project_id: projectId, title: " " },
  ])("rejects invalid updates %#", (input) => {
    expect(requirementUpdateSchema.safeParse(input).success).toBe(false);
  });
});

describe("user story", () => {
  it("trims every story field", () => {
    expect(userStorySchema.parse(Object.fromEntries(Object.entries(story).map(([key, value]) => [key, ` ${value} `])))).toEqual(story);
  });
  it.each(["code", "title", "as_a", "i_want", "so_that"])("rejects blank %s", (field) => {
    expect(userStorySchema.safeParse({ ...story, [field]: " " }).success).toBe(false);
  });
  it.each(["as_a", "i_want", "so_that"])("enforces %s length", (field) => {
    expect(userStorySchema.safeParse({ ...story, [field]: "x".repeat(2000) }).success).toBe(true);
    expect(userStorySchema.safeParse({ ...story, [field]: "x".repeat(2001) }).success).toBe(false);
  });
  it("rejects missing fields and invalid project IDs", () => {
    expect(userStorySchema.safeParse({ ...story, i_want: undefined }).success).toBe(false);
    expect(userStorySchema.safeParse({ ...story, project_id: "invalid" }).success).toBe(false);
  });
});

describe("test case", () => {
  it("trims fields and preserves internal newlines", () => {
    const parsed = testCaseSchema.parse({ ...testCase, title: " A test ", steps: "  First\nSecond  ", expected_result: " It succeeds " });
    expect(parsed).toEqual({ ...testCase, steps: "First\nSecond" });
  });
  it.each(["steps", "expected_result"])("requires bounded %s", (field) => {
    expect(testCaseSchema.safeParse({ ...testCase, [field]: " " }).success).toBe(false);
    expect(testCaseSchema.safeParse({ ...testCase, [field]: "x".repeat(10000) }).success).toBe(true);
    expect(testCaseSchema.safeParse({ ...testCase, [field]: "x".repeat(10001) }).success).toBe(false);
  });
  it.each([{ project_id: "invalid" }, { status: "TESTED" }, { code: " " }, { title: " " }, { steps: undefined }])("rejects invalid inputs %#", (patch) => {
    expect(testCaseSchema.safeParse({ ...testCase, ...patch }).success).toBe(false);
  });
});

describe("link create", () => {
  it("accepts valid endpoint types and trimmed UUIDs", () => {
    expect(linkCreateSchema.parse({ ...link, source_id: ` ${id} ` })).toEqual(link);
  });
  it.each(["project_id", "source_id", "target_id"])("rejects invalid %s", (field) => {
    expect(linkCreateSchema.safeParse({ ...link, [field]: "invalid" }).success).toBe(false);
    expect(linkCreateSchema.safeParse({ ...link, [field]: undefined }).success).toBe(false);
  });
  it.each(["source_type", "target_type"])("rejects invalid %s", (field) => {
    expect(linkCreateSchema.safeParse({ ...link, [field]: "PROJECT" }).success).toBe(false);
  });
});

describe("link delete", () => {
  it("requires both link and project IDs", () => {
    expect(linkDeleteSchema.parse({ id: ` ${id} `, project_id: projectId })).toEqual({ id, project_id: projectId });
  });
  it.each([{}, { id }, { project_id: projectId }, { id: "invalid", project_id: projectId }, { id, project_id: "invalid" }])("rejects invalid input %#", (input) => {
    expect(linkDeleteSchema.safeParse(input).success).toBe(false);
  });
});

describe("Prisma enums", () => {
  it.each([
    [prioritySchema, Priority, ["LOW", "MEDIUM", "HIGH", "CRITICAL"]],
    [requirementStatusSchema, RequirementStatus, ["DRAFT", "APPROVED", "TESTED"]],
    [testCaseStatusSchema, TestCaseStatus, ["NOT_RUN", "PASSED", "FAILED"]],
    [entityTypeSchema, EntityType, ["REQUIREMENT", "USER_STORY", "TEST_CASE"]],
  ])("matches enum values %#", (schema, values, expected) => {
    expect(Object.values(values)).toEqual(expected);
    for (const value of expected) expect(schema.safeParse(value).success).toBe(true);
    expect(schema.safeParse("unknown").success).toBe(false);
  });
});
