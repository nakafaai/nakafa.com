import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { ExamTryPaper } from "@/components/tenant/exams/try/paper";

/** One exam of the school, as its teacher tries it the way a student would. */
export default async function SchoolExamTryPage({
  params,
}: PageProps<"/[locale]/school/[slug]/exams/[exam]/try">) {
  const { exam, slug } = await params;
  if (!(Schema.is(TenantSlug)(slug) && Schema.is(Id("exams"))(exam))) {
    notFound();
  }
  return <ExamTryPaper examId={exam} slug={slug} />;
}
