"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, LoaderCircle, Plus, Search, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { createLink, deleteLink, getLinkOptions } from "../app/projects/[id]/links/actions";
import type { LinkPickerData, LinkItem } from "../lib/link-types";
import { EntityType } from "../lib/validators";

type Props = { projectId: string; sourceId: string; sourceType: EntityType; sourceCode: string };
const labels: Record<EntityType, string> = { REQUIREMENT: "Requirement", USER_STORY: "Story", TEST_CASE: "Test" };
const key = (item: LinkItem) => `${item.type}:${item.id}`;

export function LinkPicker({ projectId, sourceId, sourceType, sourceCode }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<LinkPickerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(new Set<string>());
  const requestId = useRef(0);
  const id = useId();
  const router = useRouter();

  function baseForm() {
    const form = new FormData();
    form.set("project_id", projectId); form.set("source_type", sourceType); form.set("source_id", sourceId);
    return form;
  }

  async function load() {
    const current = ++requestId.current;
    setLoading(true); setError("");
    try {
      const result = await getLinkOptions(baseForm());
      if (requestId.current !== current) return;
      if (result.error) { setError(result.error); toast.error(result.error); }
      else { setData(result.data!); setSelected(new Set()); }
    } catch {
      if (requestId.current === current) { setError("Unable to load links. Please try again."); toast.error("Unable to load links. Please try again."); }
    } finally { if (requestId.current === current) setLoading(false); }
  }

  async function add() {
    const items = data?.options.filter((item) => selected.has(key(item))) ?? [];
    if (!items.length) return;
    setBusy(true); setError("");
    try {
      const results = await Promise.all(items.map(async (item) => {
        const form = baseForm(); form.set("target_type", item.type); form.set("target_id", item.id);
        return createLink({}, form);
      }));
      const added = results.filter((result) => result.status === "success").length;
      if (added) toast.success(`${added} ${added === 1 ? "link added" : "links added"}.`);
      const failure = results.find((result) => result.status === "error");
      await load();
      if (failure) { setError(failure.message ?? "Some links could not be added."); toast.error(failure.message); }
      router.refresh();
    } catch { setError("Unable to add links. Refresh to check the current links."); toast.error("Unable to add links. Please try again."); }
    finally { setBusy(false); }
  }

  async function remove(linkId: string) {
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.set("project_id", projectId); form.set("id", linkId);
      const result = await deleteLink({}, form);
      if (result.status === "success") { toast.success(result.message); await load(); router.refresh(); }
      else { setError(result.message ?? "Unable to remove link."); toast.error(result.message); }
    } catch { setError("Unable to remove link. Please try again."); toast.error("Unable to remove link. Please try again."); }
    finally { setBusy(false); }
  }

  const normalized = query.trim().toLowerCase();
  const options = data?.options.filter((item) => `${item.code} ${item.title}`.toLowerCase().includes(normalized)) ?? [];
  const disabled = busy || loading;
  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (busy) return;
      setOpen(next);
      if (next) { setData(null); setQuery(""); setSelected(new Set()); void load(); }
      else requestId.current++;
    }}>
      <DialogTrigger render={<Button variant="outline" size="sm" aria-label={`Links for ${sourceCode}`} />}><Link2 aria-hidden="true" />Links</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg sm:max-w-lg" showCloseButton={!busy}>
        <DialogHeader><DialogTitle>Links for {sourceCode}</DialogTitle><DialogDescription>Connect requirements, stories, and tests.</DialogDescription></DialogHeader>
        {loading ? <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Loading links...</p> : data && (
          <>
            <section aria-label="Current links">
              <h3 className="mb-2 text-sm font-medium">Current links ({data.current.length})</h3>
              {data.current.length === 0 ? <p className="text-sm text-muted-foreground">No links yet.</p> : <ul className="max-h-44 overflow-y-auto divide-y">
                {data.current.map(({ id, item }) => <li key={id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0 text-sm"><span className="font-mono text-xs">{item.code}</span><p className="break-words">{item.title}</p></div>
                  <Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={() => void remove(id)} aria-label={`Remove link to ${item.code}`} title={`Remove link to ${item.code}`}><Unlink aria-hidden="true" /></Button>
                </li>)}
              </ul>}
            </section>
            <section aria-label="Linkable items" className="border-t pt-4">
              <label htmlFor={`${id}-search`} className="mb-2 block text-sm font-medium">Add links</label>
              <div className="relative"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id={`${id}-search`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or code" disabled={disabled} className="h-9 pl-9" /></div>
              <div className="mt-2 max-h-56 overflow-y-auto">
                {options.length === 0 ? <p className="py-4 text-sm text-muted-foreground">{normalized ? "No matching items." : "No more items available to link."}</p> : options.map((item) => (
                  <label key={key(item)} className="flex cursor-pointer items-start gap-3 rounded px-2 py-3 hover:bg-muted">
                    <input type="checkbox" checked={selected.has(key(item))} disabled={disabled} onChange={(event) => {
                      const next = new Set(selected); if (event.target.checked) next.add(key(item)); else next.delete(key(item)); setSelected(next);
                    }} className="mt-1 size-4 shrink-0 accent-emerald-700" />
                    <span className="min-w-0 text-sm"><span className="font-mono text-xs">{item.code}</span> <span className="text-xs text-muted-foreground">{labels[item.type]}</span><span className="block break-words">{item.title}</span></span>
                  </label>
                ))}
              </div>
            </section>
            <div className="flex justify-end border-t pt-4"><Button type="button" disabled={disabled || selected.size === 0} onClick={() => void add()}>{busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}Add selected ({selected.size})</Button></div>
          </>
        )}
        {error && <div role="alert" className="text-sm text-destructive"><p>{error}</p>{!data && <Button type="button" variant="outline" className="mt-3" disabled={disabled} onClick={() => void load()}>Retry</Button>}</div>}
      </DialogContent>
    </Dialog>
  );
}
