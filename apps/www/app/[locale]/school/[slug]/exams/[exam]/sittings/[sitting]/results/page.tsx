import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import { notFound } from "next/navigation";
import { SittingResults } from "@/components/exams/results/screen";

/**
 * The results of one sitting for its teacher. An address that names no exam, sitting, or school answers
 * not found. The results queries decide whether the viewer may read them.
 */
export default async function SittingResultsPage({
  params,
}: PageProps<"/[locale]/school/[slug]/exams/[exam]/sittings/[sitting]/results">) {
  const { exam, sitting, slug } = await params;
  const examId = Schema.decodeUnknownOption(Id("exams"))(exam);
  const sittingId = Schema.decodeUnknownOption(Id("examSittings"))(sitting);
  const tenantSlug = Schema.decodeOption(TenantSlug)(slug);
  if (
    Option.isNone(examId) ||
    Option.isNone(sittingId) ||
    Option.isNone(tenantSlug)
  ) {
    notFound();
  }
  return (
    <SittingResults
      examId={examId.value}
      sittingId={sittingId.value}
      slug={tenantSlug.value}
    />
  );
}
