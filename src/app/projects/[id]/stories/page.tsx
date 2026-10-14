import { ProjectSection } from "../../../../components/ProjectSection";

export default function StoriesPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectSection params={params} section="stories" />;
}
