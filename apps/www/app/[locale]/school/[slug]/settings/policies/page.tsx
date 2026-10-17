import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { SchoolPoliciesSettings } from "@/components/tenant/settings/policies";

/** The policies of the school: Nina, student threads, and the allowed email domains. */
export default async function SchoolPoliciesPage({
  params,
}: PageProps<"/[locale]/school/[slug]/settings/policies">) {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
    notFound();
  }
  return <SchoolPoliciesSettings slug={slug} />;
}
