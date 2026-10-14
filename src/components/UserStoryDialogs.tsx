"use client";

import { useActionState, useId, useState } from "react";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { createUserStory, updateUserStory, deleteUserStory } from "../app/projects/[id]/stories/actions";
import type { UserStoryActionState } from "../lib/validators";

type UserStory = { id: string; code: string; title: string; as_a: string; i_want: string; so_that: string };
type Props = { projectId: string; story?: UserStory };

function StoryForm({ projectId, story, onSuccess }: Props & { onSuccess: () => void }) {
  const prefix = useId();
  const [state, action, pending] = useActionState<UserStoryActionState, FormData>(async (previous, data) => {
    const result = await (story ? updateUserStory : createUserStory)(previous, data);
    if (result.status === "success") { toast.success(result.message); onSuccess(); }
    else toast.error(result.message);
    return result;
  }, {});
  const values = state.values ?? { title: story?.title ?? "", as_a: story?.as_a ?? "", i_want: story?.i_want ?? "", so_that: story?.so_that ?? "" };
  const error = (field: string) => state.fieldErrors?.[field]?.[0];
  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      {story && <input type="hidden" name="id" value={story.id} />}
      <div>
        <label htmlFor={`${prefix}-title`} className="mb-2 block text-sm font-medium">Title</label>
        <Input id={`${prefix}-title`} name="title" defaultValue={values.title} required maxLength={200} disabled={pending} className="h-10"
          aria-invalid={Boolean(error("title"))} aria-describedby={error("title") ? `${prefix}-title-error` : undefined} />
        {error("title") && <p id={`${prefix}-title-error`} className="mt-2 text-sm text-destructive">{error("title")}</p>}
      </div>
      {([
        { field: "as_a", label: "As a" }, { field: "i_want", label: "I want" }, { field: "so_that", label: "So that" },
      ] as const).map(({ field, label }) => (
        <div key={field}>
          <label htmlFor={`${prefix}-${field}`} className="mb-2 block text-sm font-medium">{label}</label>
          <textarea id={`${prefix}-${field}`} name={field} defaultValue={values[field]} required maxLength={2000} rows={2} disabled={pending}
            className="block w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            aria-invalid={Boolean(error(field))} aria-describedby={error(field) ? `${prefix}-${field}-error` : undefined} />
          {error(field) && <p id={`${prefix}-${field}-error`} className="mt-2 text-sm text-destructive">{error(field)}</p>}
        </div>
      ))}
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <div className="flex justify-end gap-2 border-t pt-4">
        <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : story ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {pending ? "Saving..." : story ? "Save changes" : "Create story"}
        </Button>
      </div>
    </form>
  );
}

export function UserStoryDialog({ projectId, story }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {story ? (
        <DialogTrigger render={<Button variant="ghost" size="icon" title={`Edit ${story.code}`} aria-label={`Edit ${story.code}`} />}><Pencil aria-hidden="true" /></DialogTrigger>
      ) : (
        <DialogTrigger render={<Button className="h-9" />}><Plus aria-hidden="true" />New story</DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{story ? `Edit ${story.code}` : "New story"}</DialogTitle>
          <DialogDescription>{story ? story.code : "Add a user story to this project."}</DialogDescription>
        </DialogHeader>
        {open && <StoryForm projectId={projectId} story={story} onSuccess={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function DeleteForm({ projectId, story, onSuccess }: { projectId: string; story: UserStory; onSuccess: () => void }) {
  const [state, action, pending] = useActionState<UserStoryActionState, FormData>(async (previous, data) => {
    const result = await deleteUserStory(previous, data);
    if (result.status === "success") { toast.success(result.message); onSuccess(); }
    else toast.error(result.message);
    return result;
  }, {});
  return (
    <form action={action}>
      <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="id" value={story.id} />
      {state.status === "error" && <p role="alert" className="mb-4 text-sm text-destructive">{state.message}</p>}
      <div className="flex justify-end gap-2 border-t pt-4">
        <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
          {pending ? "Deleting..." : "Delete story"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteUserStoryDialog({ projectId, story }: { projectId: string; story: UserStory }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" title={`Delete ${story.code}`} aria-label={`Delete ${story.code}`} />}><Trash2 aria-hidden="true" /></DialogTrigger>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>Delete {story.code}?</DialogTitle>
          <DialogDescription className="break-words">This permanently deletes <strong>{story.title}</strong> and its links. Linked requirements and tests are kept.</DialogDescription>
        </DialogHeader>
        {open && <DeleteForm projectId={projectId} story={story} onSuccess={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
