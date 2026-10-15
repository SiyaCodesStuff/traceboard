"use client";

import { useId, useTransition, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Search, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Priority, RequirementStatus, TestCaseStatus } from "../lib/validators";

type Props = { kind: "requirements" | "stories" | "tests"; query: string; priority?: Priority; status?: RequirementStatus | TestCaseStatus };

export function ListFilters({ kind, query, priority, status }: Props) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const active = Boolean(query || (kind === "requirements" && priority) || (kind !== "stories" && status));
  const options = kind === "requirements" ? Object.values(RequirementStatus) : Object.values(TestCaseStatus);

  function navigate(data?: FormData) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["q", "priority", "status"]) params.delete(key);
    if (data) {
      for (const key of ["q", "priority", "status"]) {
        const value = String(data.get(key) ?? "").trim();
        if (value) params.set(key, value);
      }
    }
    const suffix = params.toString();
    startTransition(() => router.push(`${pathname}${suffix ? `?${suffix}` : ""}`, { scroll: false }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(new FormData(event.currentTarget));
  }

  return (
    <form key={JSON.stringify([query, priority, status])} onSubmit={submit} aria-label="List filters" className="mb-5 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[180px] flex-1">
        <label htmlFor={`${id}-search`} className="sr-only">Search title or code</label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input id={`${id}-search`} name="q" defaultValue={query} maxLength={200} placeholder="Search title or code" disabled={pending} className="h-9 pl-9" />
      </div>
      {kind === "requirements" && (
        <div>
          <label htmlFor={`${id}-priority`} className="sr-only">Priority</label>
          <select id={`${id}-priority`} name="priority" defaultValue={priority ?? ""} disabled={pending} className="h-9 w-36 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">All priorities</option>
            {Object.values(Priority).map((value) => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
      )}
      {kind !== "stories" && (
        <div>
          <label htmlFor={`${id}-status`} className="sr-only">Status</label>
          <select id={`${id}-status`} name="status" defaultValue={status ?? ""} disabled={pending} className="h-9 w-36 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">All statuses</option>
            {options.map((value) => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ")}</option>)}
          </select>
        </div>
      )}
      <Button type="submit" size="icon" disabled={pending} aria-label="Apply filters" title="Apply filters" className="size-9">
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
      </Button>
      <Button type="button" variant="ghost" size="icon" disabled={pending || !active} onClick={() => navigate()} aria-label="Clear filters" title="Clear filters" className="size-9"><X aria-hidden="true" /></Button>
    </form>
  );
}
