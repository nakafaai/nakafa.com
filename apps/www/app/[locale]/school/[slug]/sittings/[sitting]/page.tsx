import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import { notFound } from "next/navigation";
import { StudentSitting } from "@/components/exams/sitting/student";

/**
 * A student's screen of one sitting. An address that names no sitting or school answers not
 * found. The sitting itself decides whether the student may enter it.
 */
export default async function StudentSittingPage({
  params,
}: PageProps<"/[locale]/school/[slug]/sittings/[sitting]">) {
  const { sitting, slug } = await params;
  const sittingId = Schema.decodeUnknownOption(Id("examSittings"))(sitting);
  const tenantSlug = Schema.decodeOption(TenantSlug)(slug);
  if (Option.isNone(sittingId) || Option.isNone(tenantSlug)) {
    notFound();
  }
  return <StudentSitting sittingId={sittingId.value} slug={tenantSlug.value} />;
}
