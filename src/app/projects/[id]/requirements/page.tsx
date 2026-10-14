import { ProjectSection } from "../../../../components/ProjectSection";

export default function RequirementsPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectSection params={params} section="requirements" />;
}
