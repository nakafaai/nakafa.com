import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { canOpenExams } from "@/components/tenant/exams/access";
import { ExamList } from "@/components/tenant/exams/list";
import { readViewer } from "@/lib/tenant/read";

/**
 * The exams of the school, newest first. The layout admits the viewers of the rooms too, so this
 * page reads the viewer and answers not found for one who may not view exams: the exam list is
 * for the editors of the school only.
 */
export default async function SchoolExamsPage({
  params,
}: PageProps<"/[locale]/school/[slug]/exams">) {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
    notFound();
  }
  const viewer = await readViewer(slug);
  if (viewer._tag !== "member" || !canOpenExams(viewer.viewer)) {
    notFound();
  }
  return <ExamList slug={slug} />;
}
