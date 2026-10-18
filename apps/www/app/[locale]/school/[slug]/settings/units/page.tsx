import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { SchoolUnitsSettings } from "@/components/tenant/settings/units";

/** The units of the school, with their time zones and content languages. */
export default async function SchoolUnitsPage({
  params,
}: PageProps<"/[locale]/school/[slug]/settings/units">) {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
    notFound();
  }
  return <SchoolUnitsSettings slug={slug} />;
}
