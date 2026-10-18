import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import { notFound } from "next/navigation";
import { SittingDashboard } from "@/components/exams/sitting/dashboard";

/**
 * The proctor's dashboard of one sitting. An address that names no exam, sitting, or school
 * answers not found. The dashboard's query decides whether the viewer may view the sitting.
 */
export default async function SittingDashboardPage({
  params,
}: PageProps<"/[locale]/school/[slug]/exams/[exam]/sittings/[sitting]">) {
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
    <SittingDashboard
      examId={examId.value}
      sittingId={sittingId.value}
      slug={tenantSlug.value}
    />
  );
}
