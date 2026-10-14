import { ProjectSection } from "../../../../components/ProjectSection";

export default function MatrixPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectSection params={params} section="matrix" />;
}
