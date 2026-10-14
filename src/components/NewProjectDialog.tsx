"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { createProject } from "../app/dashboard/actions";
import type { ProjectActionState } from "../lib/validators";

function NewProjectForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action, pending] = useActionState<ProjectActionState, FormData>(async (previous, data) => {
    const result = await createProject(previous, data);
    if (result.status === "success") {
      toast.success(result.message);
      onSuccess();
    } else toast.error(result.message);
    return result;
  }, {});

  return (
    <form action={action} noValidate className="space-y-5">
      <div>
        <label htmlFor="project-name" className="mb-2 block text-sm font-medium">Name</label>
        <Input id="project-name" name="name" defaultValue={state.values?.name} required maxLength={120} disabled={pending} className="h-10"
          aria-invalid={Boolean(state.fieldErrors?.name)} aria-describedby={state.fieldErrors?.name ? "project-name-error" : undefined} />
        {state.fieldErrors?.name && <p id="project-name-error" className="mt-2 text-sm text-destructive">{state.fieldErrors.name[0]}</p>}
      </div>
      <div>
        <label htmlFor="project-description" className="mb-2 block text-sm font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea id="project-description" name="description" defaultValue={state.values?.description} maxLength={2000} disabled={pending} rows={4}
          className="block w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          aria-invalid={Boolean(state.fieldErrors?.description)} aria-describedby={state.fieldErrors?.description ? "project-description-error" : undefined} />
        {state.fieldErrors?.description && <p id="project-description-error" className="mt-2 text-sm text-destructive">{state.fieldErrors.description[0]}</p>}
      </div>
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <div className="flex justify-end border-t pt-4">
        <Button type="submit" disabled={pending} className="h-9">
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {pending ? "Creating..." : "Create project"}
        </Button>
      </div>
    </form>
  );
}

export function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="h-9" />}><Plus aria-hidden="true" />New project</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Give your project a name and an optional description.</DialogDescription>
        </DialogHeader>
        {open && <NewProjectForm onSuccess={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
