import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { SchoolInvitesSettings } from "@/components/tenant/settings/invites";

/** The pending invites of the school. */
export default async function SchoolInvitesPage({
  params,
}: PageProps<"/[locale]/school/[slug]/settings/invites">) {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
    notFound();
  }
  return <SchoolInvitesSettings slug={slug} />;
}
