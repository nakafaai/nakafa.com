import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { SchoolStudentsSettings } from "@/components/tenant/settings/students";

/** The login cards of the school's people. */
export default async function SchoolStudentsPage({
  params,
}: PageProps<"/[locale]/school/[slug]/settings/students">) {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
    notFound();
  }
  return <SchoolStudentsSettings slug={slug} />;
}
