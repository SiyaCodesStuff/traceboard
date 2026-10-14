import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../../components/ui/table";
import { requireUser } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { getOwnedProject } from "../../../../lib/project-access";
import { UserStoryDialog, DeleteUserStoryDialog } from "../../../../components/UserStoryDialogs";

async function Stories({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await requireUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id);
  if (!project) notFound();
  const stories = await db.userStory.findMany({
    where: { project_id: project.id, project: { owner_id: user.id } },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: { id: true, code: true, title: true, as_a: true, i_want: true, so_that: true },
  });
  return (
    <section aria-labelledby="stories-heading">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><h2 id="stories-heading" className="text-lg font-semibold">Stories</h2><p className="mt-1 text-sm text-muted-foreground">{stories.length} {stories.length === 1 ? "story" : "stories"}</p></div>
        <UserStoryDialog projectId={project.id} />
      </div>
      <Table className="min-w-[680px]">
        <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Title</TableHead><TableHead>Story</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
        <TableBody>
          {stories.length === 0 ? <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">No stories yet.</TableCell></TableRow> : stories.map((story) => (
            <TableRow key={story.id}>
              <TableCell className="font-mono text-xs">{story.code}</TableCell>
              <TableCell className="min-w-40 max-w-xs whitespace-normal"><span className="block break-words font-medium">{story.title}</span></TableCell>
              <TableCell className="min-w-64 max-w-lg whitespace-normal"><p className="break-words leading-6">As a {story.as_a}, I want {story.i_want}, so that {story.so_that}.</p></TableCell>
              <TableCell><div className="flex justify-end gap-1"><UserStoryDialog projectId={project.id} story={story} /><DeleteUserStoryDialog projectId={project.id} story={story} /></div></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

export default function StoriesPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">Loading stories...</p>}><Stories params={params} /></Suspense>;
}
