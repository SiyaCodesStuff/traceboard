import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Project not found</h1>
      <p className="mt-3 text-sm text-muted-foreground">This project is unavailable or you do not have access.</p>
      <Link href="/dashboard" className="mt-5 inline-block text-sm underline underline-offset-4">Back to your projects</Link>
    </section>
  );
}
