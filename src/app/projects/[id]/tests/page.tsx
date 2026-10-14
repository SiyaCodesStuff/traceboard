import { ProjectSection } from "../../../../components/ProjectSection";

export default function TestsPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectSection params={params} section="tests" />;
}
