import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireUser } from "../lib/auth";
import { getOwnedProject } from "../lib/project-access";

type Props = { params: Promise<{ id: string }>; section: "requirements" | "stories" | "tests" | "matrix" };

async function SectionContent({ params, section }: Props) {
  await connection();
  const user = await requireUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id);
  if (!project) notFound();
  const sections = {
    requirements: { title: "Requirements", count: project._count.requirements, item: "requirements" },
    stories: { title: "Stories", count: project._count.user_stories, item: "stories" },
    tests: { title: "Tests", count: project._count.test_cases, item: "tests" },
    matrix: { title: "Matrix", count: project._count.links, item: "links" },
  };
  const current = sections[section];
  return (
    <section>
      <h2 className="text-lg font-semibold">{current.title}</h2>
      <p className="mt-3 text-sm text-muted-foreground">{current.count === 0 ? `No ${current.item} yet.` : `${current.count} ${current.item}`}</p>
    </section>
  );
}

export function ProjectSection(props: Props) {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}><SectionContent {...props} /></Suspense>;
}
