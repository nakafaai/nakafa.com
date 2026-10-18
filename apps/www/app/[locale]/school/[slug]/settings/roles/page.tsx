import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { SchoolRolesSettings } from "@/components/tenant/settings/roles";

/** The roles of the people of the school. */
export default async function SchoolRolesPage({
  params,
}: PageProps<"/[locale]/school/[slug]/settings/roles">) {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
    notFound();
  }
  return <SchoolRolesSettings slug={slug} />;
}
