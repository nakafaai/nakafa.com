import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { ExamEditor } from "@/components/tenant/exams/editor";

/** The editor of one exam of the school. */
export default async function SchoolExamEditPage({
  params,
}: PageProps<"/[locale]/school/[slug]/exams/[exam]/edit">) {
  const { exam, slug } = await params;
  if (!(Schema.is(TenantSlug)(slug) && Schema.is(Id("exams"))(exam))) {
    notFound();
  }
  return <ExamEditor examId={exam} slug={slug} />;
}
