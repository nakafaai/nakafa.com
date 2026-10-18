import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { ExamList } from "@/components/tenant/exams/list";

/** The exams of the school, newest first. */
export default async function SchoolExamsPage({
  params,
}: PageProps<"/[locale]/school/[slug]/exams">) {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
    notFound();
  }
  return <ExamList slug={slug} />;
}
