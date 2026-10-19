import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { canOpenExams } from "@/components/tenant/exams/access";
import { ExamEditor } from "@/components/tenant/exams/editor";
import { readViewer } from "@/lib/tenant/read";

/**
 * The editor of one exam of the school. The editor is for the exam editors, as the exam list is,
 * so a viewer who reads the rooms of an exam alone gets not found here. The exam's own queries
 * still decide what the viewer may read and change in it.
 */
export default async function SchoolExamEditPage({
  params,
}: PageProps<"/[locale]/school/[slug]/exams/[exam]/edit">) {
  const { exam, slug } = await params;
  if (!(Schema.is(TenantSlug)(slug) && Schema.is(Id("exams"))(exam))) {
    notFound();
  }
  const viewer = await readViewer(slug);
  if (viewer._tag !== "member" || !canOpenExams(viewer.viewer)) {
    notFound();
  }
  return <ExamEditor examId={exam} slug={slug} />;
}
