import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { SchoolMembersSettings } from "@/components/tenant/settings/members";

/** Every active member of the school, with its roles and how far it has joined. */
export default async function SchoolMembersPage({
  params,
}: PageProps<"/[locale]/school/[slug]/settings/members">) {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
    notFound();
  }
  return <SchoolMembersSettings slug={slug} />;
}
