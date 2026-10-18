import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { SchoolCohortsSettings } from "@/components/tenant/settings/cohorts";

/** The cohorts, the rombel, of the active period of each unit of the school. */
export default async function SchoolCohortsPage({
  params,
}: PageProps<"/[locale]/school/[slug]/settings/cohorts">) {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
    notFound();
  }
  return <SchoolCohortsSettings slug={slug} />;
}
