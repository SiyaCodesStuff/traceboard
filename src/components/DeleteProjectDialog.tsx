"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { deleteProject } from "../app/dashboard/actions";
import type { ProjectActionState } from "../lib/validators";

function DeleteProjectForm({ projectId, onSuccess }: { projectId: string; onSuccess: () => void }) {
  const [state, action, pending] = useActionState<ProjectActionState, FormData>(async (previous, data) => {
    const result = await deleteProject(previous, data);
    if (result.status === "success") {
      toast.success(result.message);
      onSuccess();
    } else toast.error(result.message);
    return result;
  }, {});
  return (
    <form action={action}>
      <input type="hidden" name="project_id" value={projectId} />
      {state.status === "error" && <p role="alert" className="mb-4 text-sm text-destructive">{state.message}</p>}
      <div className="flex justify-end gap-2 border-t pt-4">
        <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
          {pending ? "Deleting..." : "Delete project"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteProjectDialog({ projectId, name }: { projectId: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" title={`Delete ${name}`} aria-label={`Delete ${name}`} />}>
        <Trash2 aria-hidden="true" />
      </DialogTrigger>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>Delete project?</DialogTitle>
          <DialogDescription className="break-words">Deleting <strong>{name}</strong> permanently removes its requirements, stories, tests, and links. This cannot be undone.</DialogDescription>
        </DialogHeader>
        {open && <DeleteProjectForm projectId={projectId} onSuccess={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
