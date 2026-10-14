"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, FileText, LayoutGrid, List, ScrollText } from "lucide-react";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = [
    { label: "Overview", path: "", Icon: LayoutGrid },
    { label: "Requirements", path: "/requirements", Icon: FileText },
    { label: "Stories", path: "/stories", Icon: ScrollText },
    { label: "Tests", path: "/tests", Icon: ClipboardCheck },
    { label: "Matrix", path: "/matrix", Icon: List },
  ];
  return (
    <nav aria-label="Project views" className="mt-6 flex gap-5 overflow-x-auto border-b">
      {tabs.map(({ label, path, Icon }) => {
        const href = `${base}${path}`;
        const active = path ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
        return (
          <Link key={label} href={href} aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 border-b-2 py-3 text-sm font-medium ${active ? "border-emerald-700 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="size-4" aria-hidden="true" />{label}
          </Link>
        );
      })}
    </nav>
  );
}
