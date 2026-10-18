import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { SchoolPeriodsSettings } from "@/components/tenant/settings/periods";

/** The periods of each unit of the school. */
export default async function SchoolPeriodsPage({
  params,
}: PageProps<"/[locale]/school/[slug]/settings/periods">) {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
    notFound();
  }
  return <SchoolPeriodsSettings slug={slug} />;
}
