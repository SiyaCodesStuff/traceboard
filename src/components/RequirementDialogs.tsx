"use client";

import { useActionState, useId, useState } from "react";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { createRequirement, updateRequirement, deleteRequirement } from "../app/projects/[id]/requirements/actions";
import { Priority, RequirementStatus, type RequirementActionState } from "../lib/validators";

type Requirement = { id: string; code: string; title: string; description: string | null; priority: Priority; status: RequirementStatus };
type Props = { projectId: string; requirement?: Requirement };
const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

function RequirementForm({ projectId, requirement, onSuccess }: Props & { onSuccess: () => void }) {
  const prefix = useId();
  const [state, action, pending] = useActionState<RequirementActionState, FormData>(async (previous, data) => {
    const result = await (requirement ? updateRequirement : createRequirement)(previous, data);
    if (result.status === "success") { toast.success(result.message); onSuccess(); }
    else toast.error(result.message);
    return result;
  }, {});
  const values = state.values ?? { title: requirement?.title ?? "", description: requirement?.description ?? "", priority: requirement?.priority ?? Priority.MEDIUM, status: requirement?.status ?? RequirementStatus.DRAFT };
  const error = (field: string) => state.fieldErrors?.[field]?.[0];
  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      {requirement && <input type="hidden" name="id" value={requirement.id} />}
      <div>
        <label htmlFor={`${prefix}-title`} className="mb-2 block text-sm font-medium">Title</label>
        <Input id={`${prefix}-title`} name="title" defaultValue={values.title} required maxLength={200} disabled={pending} className="h-10"
          aria-invalid={Boolean(error("title"))} aria-describedby={error("title") ? `${prefix}-title-error` : undefined} />
        {error("title") && <p id={`${prefix}-title-error`} className="mt-2 text-sm text-destructive">{error("title")}</p>}
      </div>
      <div>
        <label htmlFor={`${prefix}-description`} className="mb-2 block text-sm font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea id={`${prefix}-description`} name="description" defaultValue={values.description} maxLength={2000} rows={3} disabled={pending}
          className="block w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          aria-invalid={Boolean(error("description"))} aria-describedby={error("description") ? `${prefix}-description-error` : undefined} />
        {error("description") && <p id={`${prefix}-description-error`} className="mt-2 text-sm text-destructive">{error("description")}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { field: "priority", label: "Priority", options: Object.values(Priority) },
          { field: "status", label: "Status", options: Object.values(RequirementStatus) },
        ].map(({ field, label, options }) => (
          <div key={field}>
            <label htmlFor={`${prefix}-${field}`} className="mb-2 block text-sm font-medium">{label}</label>
            <select id={`${prefix}-${field}`} name={field} defaultValue={field === "priority" ? values.priority : values.status} disabled={pending}
              className={selectClass} aria-invalid={Boolean(error(field))} aria-describedby={error(field) ? `${prefix}-${field}-error` : undefined}>
              {options.map((value) => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>)}
            </select>
            {error(field) && <p id={`${prefix}-${field}-error`} className="mt-2 text-sm text-destructive">{error(field)}</p>}
          </div>
        ))}
      </div>
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <div className="flex justify-end gap-2 border-t pt-4">
        <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : requirement ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {pending ? "Saving..." : requirement ? "Save changes" : "Create requirement"}
        </Button>
      </div>
    </form>
  );
}

export function RequirementDialog({ projectId, requirement }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {requirement ? (
        <DialogTrigger render={<Button variant="ghost" size="icon" title={`Edit ${requirement.code}`} aria-label={`Edit ${requirement.code}`} />}><Pencil aria-hidden="true" /></DialogTrigger>
      ) : (
        <DialogTrigger render={<Button className="h-9" />}><Plus aria-hidden="true" />New requirement</DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{requirement ? `Edit ${requirement.code}` : "New requirement"}</DialogTitle>
          <DialogDescription>{requirement ? requirement.code : "Add a requirement to this project."}</DialogDescription>
        </DialogHeader>
        {open && <RequirementForm projectId={projectId} requirement={requirement} onSuccess={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function DeleteForm({ projectId, requirement, onSuccess }: { projectId: string; requirement: Requirement; onSuccess: () => void }) {
  const [state, action, pending] = useActionState<RequirementActionState, FormData>(async (previous, data) => {
    const result = await deleteRequirement(previous, data);
    if (result.status === "success") { toast.success(result.message); onSuccess(); }
    else toast.error(result.message);
    return result;
  }, {});
  return (
    <form action={action}>
      <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="id" value={requirement.id} />
      {state.status === "error" && <p role="alert" className="mb-4 text-sm text-destructive">{state.message}</p>}
      <div className="flex justify-end gap-2 border-t pt-4">
        <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
          {pending ? "Deleting..." : "Delete requirement"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteRequirementDialog({ projectId, requirement }: { projectId: string; requirement: Requirement }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" title={`Delete ${requirement.code}`} aria-label={`Delete ${requirement.code}`} />}><Trash2 aria-hidden="true" /></DialogTrigger>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>Delete {requirement.code}?</DialogTitle>
          <DialogDescription className="break-words">This permanently deletes <strong>{requirement.title}</strong> and its links. Linked tests are kept.</DialogDescription>
        </DialogHeader>
        {open && <DeleteForm projectId={projectId} requirement={requirement} onSuccess={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
