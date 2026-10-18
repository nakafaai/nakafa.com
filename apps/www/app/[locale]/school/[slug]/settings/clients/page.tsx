import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { SchoolClientsSettings } from "@/components/tenant/settings/clients";

/** The integration clients of the school. */
export default async function SchoolClientsPage({
  params,
}: PageProps<"/[locale]/school/[slug]/settings/clients">) {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
    notFound();
  }
  return <SchoolClientsSettings slug={slug} />;
}
