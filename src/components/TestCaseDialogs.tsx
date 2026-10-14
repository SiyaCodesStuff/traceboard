"use client";

import { useActionState, useId, useState } from "react";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { createTestCase, updateTestCase, deleteTestCase } from "../app/projects/[id]/tests/actions";
import { TestCaseStatus, type TestCaseActionState } from "../lib/validators";

type TestCase = { id: string; code: string; title: string; steps: string; expected_result: string; status: TestCaseStatus };
type Props = { projectId: string; testCase?: TestCase };

function TestCaseForm({ projectId, testCase, onSuccess }: Props & { onSuccess: () => void }) {
  const prefix = useId();
  const [state, action, pending] = useActionState<TestCaseActionState, FormData>(async (previous, data) => {
    const result = await (testCase ? updateTestCase : createTestCase)(previous, data);
    if (result.status === "success") { toast.success(result.message); onSuccess(); }
    else toast.error(result.message);
    return result;
  }, {});
  const values = state.values ?? { title: testCase?.title ?? "", steps: testCase?.steps ?? "", expected_result: testCase?.expected_result ?? "", status: testCase?.status ?? TestCaseStatus.NOT_RUN };
  const error = (field: string) => state.fieldErrors?.[field]?.[0];
  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      {testCase && <input type="hidden" name="id" value={testCase.id} />}
      <div>
        <label htmlFor={`${prefix}-title`} className="mb-2 block text-sm font-medium">Title</label>
        <Input id={`${prefix}-title`} name="title" defaultValue={values.title} required maxLength={200} disabled={pending} className="h-10"
          aria-invalid={Boolean(error("title"))} aria-describedby={error("title") ? `${prefix}-title-error` : undefined} />
        {error("title") && <p id={`${prefix}-title-error`} className="mt-2 text-sm text-destructive">{error("title")}</p>}
      </div>
      {([
        { field: "steps", label: "Steps" }, { field: "expected_result", label: "Expected result" },
      ] as const).map(({ field, label }) => (
        <div key={field}>
          <label htmlFor={`${prefix}-${field}`} className="mb-2 block text-sm font-medium">{label}</label>
          <textarea id={`${prefix}-${field}`} name={field} defaultValue={values[field]} required maxLength={10000} rows={3} disabled={pending}
            className="block w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            aria-invalid={Boolean(error(field))} aria-describedby={error(field) ? `${prefix}-${field}-error` : undefined} />
          {error(field) && <p id={`${prefix}-${field}-error`} className="mt-2 text-sm text-destructive">{error(field)}</p>}
        </div>
      ))}
      <div>
        <label htmlFor={`${prefix}-status`} className="mb-2 block text-sm font-medium">Status</label>
        <select id={`${prefix}-status`} name="status" defaultValue={values.status} disabled={pending}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          aria-invalid={Boolean(error("status"))} aria-describedby={error("status") ? `${prefix}-status-error` : undefined}>
          <option value={TestCaseStatus.NOT_RUN}>Not run</option><option value={TestCaseStatus.PASSED}>Passed</option><option value={TestCaseStatus.FAILED}>Failed</option>
        </select>
        {error("status") && <p id={`${prefix}-status-error`} className="mt-2 text-sm text-destructive">{error("status")}</p>}
      </div>
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <div className="flex justify-end gap-2 border-t pt-4">
        <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : testCase ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {pending ? "Saving..." : testCase ? "Save changes" : "Create test case"}
        </Button>
      </div>
    </form>
  );
}

export function TestCaseDialog({ projectId, testCase }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {testCase ? (
        <DialogTrigger render={<Button variant="ghost" size="icon" title={`Edit ${testCase.code}`} aria-label={`Edit ${testCase.code}`} />}><Pencil aria-hidden="true" /></DialogTrigger>
      ) : (
        <DialogTrigger render={<Button className="h-9" />}><Plus aria-hidden="true" />New test case</DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{testCase ? `Edit ${testCase.code}` : "New test case"}</DialogTitle>
          <DialogDescription>{testCase ? testCase.code : "Add a test case to this project."}</DialogDescription>
        </DialogHeader>
        {open && <TestCaseForm projectId={projectId} testCase={testCase} onSuccess={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function DeleteForm({ projectId, testCase, onSuccess }: { projectId: string; testCase: TestCase; onSuccess: () => void }) {
  const [state, action, pending] = useActionState<TestCaseActionState, FormData>(async (previous, data) => {
    const result = await deleteTestCase(previous, data);
    if (result.status === "success") { toast.success(result.message); onSuccess(); }
    else toast.error(result.message);
    return result;
  }, {});
  return (
    <form action={action}>
      <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="id" value={testCase.id} />
      {state.status === "error" && <p role="alert" className="mb-4 text-sm text-destructive">{state.message}</p>}
      <div className="flex justify-end gap-2 border-t pt-4">
        <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
          {pending ? "Deleting..." : "Delete test case"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteTestCaseDialog({ projectId, testCase }: { projectId: string; testCase: TestCase }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" title={`Delete ${testCase.code}`} aria-label={`Delete ${testCase.code}`} />}><Trash2 aria-hidden="true" /></DialogTrigger>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>Delete {testCase.code}?</DialogTitle>
          <DialogDescription className="break-words">This permanently deletes <strong>{testCase.title}</strong> and its links. Linked requirements and stories are kept.</DialogDescription>
        </DialogHeader>
        {open && <DeleteForm projectId={projectId} testCase={testCase} onSuccess={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
