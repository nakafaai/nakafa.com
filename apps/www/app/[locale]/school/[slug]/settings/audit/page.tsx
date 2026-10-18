import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { SchoolAuditSettings } from "@/components/tenant/settings/audit";

/** The audit log of the school: who changed what, and when. */
export default async function SchoolAuditPage({
  params,
}: PageProps<"/[locale]/school/[slug]/settings/audit">) {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
    notFound();
  }
  return <SchoolAuditSettings slug={slug} />;
}
