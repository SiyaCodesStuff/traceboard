import { z } from "zod";
import { EntityType, Priority, RequirementStatus, TestCaseStatus } from "../generated/prisma/enums";

export { EntityType, Priority, RequirementStatus, TestCaseStatus };
export const prioritySchema = z.enum(Priority);
export const requirementStatusSchema = z.enum(RequirementStatus);
export const testCaseStatusSchema = z.enum(TestCaseStatus);
export const entityTypeSchema = z.enum(EntityType);

export const authSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must contain at least 8 characters."),
});

export type AuthState = {
  status?: "error" | "confirmation";
  message?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
  email?: string;
};

const uuidSchema = z.string().trim().uuid("Enter a valid UUID.");
const titleSchema = z.string().trim().min(1, "Enter a title.").max(200, "Use at most 200 characters.");
const codeSchema = z.string().trim().min(1, "Enter a code.").max(40, "Use at most 40 characters.");
const descriptionSchema = z.string().trim().max(2000, "Use at most 2,000 characters.").nullable().optional();
const storyTextSchema = z.string().trim().min(1, "This field is required.").max(2000, "Use at most 2,000 characters.");
const testTextSchema = z.string().trim().min(1, "This field is required.").max(10000, "Use at most 10,000 characters.");

// IDs identify update targets; ownership and generated timestamps stay server-controlled.
function hasChanges(values: Record<string, unknown>) {
  return Object.entries(values).some(([key, value]) => key !== "id" && key !== "project_id" && value !== undefined);
}

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, "Enter a project name.").max(120, "Use at most 120 characters."),
  description: descriptionSchema,
});

export const projectUpdateSchema = projectCreateSchema.partial().extend({ id: uuidSchema })
  .refine(hasChanges, "Provide at least one field to update.");

// Keep the existing project action's schema name compatible.
export const projectSchema = projectCreateSchema;
export const projectIdSchema = uuidSchema;

const requirementFields = z.object({
  code: codeSchema,
  title: titleSchema,
  description: descriptionSchema,
  priority: prioritySchema,
  status: requirementStatusSchema,
});
export const requirementCreateSchema = requirementFields.extend({ project_id: uuidSchema });
export const requirementFormSchema = requirementCreateSchema.omit({ code: true });
export const requirementEditFormSchema = requirementFormSchema.extend({ id: uuidSchema });
export const requirementDeleteSchema = z.object({ id: uuidSchema, project_id: uuidSchema });
export const requirementUpdateSchema = requirementFields.partial().extend({ id: uuidSchema, project_id: uuidSchema })
  .refine(hasChanges, "Provide at least one field to update.");

export const userStorySchema = z.object({
  project_id: uuidSchema,
  code: codeSchema,
  title: titleSchema,
  as_a: storyTextSchema,
  i_want: storyTextSchema,
  so_that: storyTextSchema,
});
export const userStoryFormSchema = userStorySchema.omit({ code: true });
export const userStoryEditFormSchema = userStoryFormSchema.extend({ id: uuidSchema });
export const userStoryDeleteSchema = z.object({ id: uuidSchema, project_id: uuidSchema });

export const testCaseSchema = z.object({
  project_id: uuidSchema,
  code: codeSchema,
  title: titleSchema,
  steps: testTextSchema,
  expected_result: testTextSchema,
  status: testCaseStatusSchema,
});
export const testCaseFormSchema = testCaseSchema.omit({ code: true });
export const testCaseEditFormSchema = testCaseFormSchema.extend({ id: uuidSchema });
export const testCaseDeleteSchema = z.object({ id: uuidSchema, project_id: uuidSchema });

export const linkCreateSchema = z.object({
  project_id: uuidSchema,
  source_type: entityTypeSchema,
  source_id: uuidSchema,
  target_type: entityTypeSchema,
  target_id: uuidSchema,
}).refine((link) => link.source_id !== link.target_id, "Self-links are not allowed.")
  .refine((link) => link.source_type !== link.target_type, "Link two different item types.");
export const linkDeleteSchema = z.object({ id: uuidSchema, project_id: uuidSchema });
export const linkPickerSchema = z.object({ project_id: uuidSchema, source_type: entityTypeSchema, source_id: uuidSchema });

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type RequirementCreateInput = z.infer<typeof requirementCreateSchema>;
export type RequirementUpdateInput = z.infer<typeof requirementUpdateSchema>;
export type RequirementFormInput = z.infer<typeof requirementFormSchema>;
export type RequirementActionState = {
  status?: "error" | "success";
  message?: string;
  code?: string;
  id?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: { title: string; description: string; priority: string; status: string };
};
export type UserStoryInput = z.infer<typeof userStorySchema>;
export type UserStoryFormInput = z.infer<typeof userStoryFormSchema>;
export type UserStoryActionState = {
  status?: "error" | "success";
  message?: string;
  code?: string;
  id?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: { title: string; as_a: string; i_want: string; so_that: string };
};
export type TestCaseInput = z.infer<typeof testCaseSchema>;
export type TestCaseFormInput = z.infer<typeof testCaseFormSchema>;
export type TestCaseActionState = {
  status?: "error" | "success";
  message?: string;
  code?: string;
  id?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: { title: string; steps: string; expected_result: string; status: string };
};
export type LinkCreateInput = z.infer<typeof linkCreateSchema>;
export type LinkDeleteInput = z.infer<typeof linkDeleteSchema>;

export type ProjectActionState = {
  status?: "error" | "success";
  message?: string;
  fieldErrors?: { name?: string[]; description?: string[] };
  values?: { name: string; description: string };
};
