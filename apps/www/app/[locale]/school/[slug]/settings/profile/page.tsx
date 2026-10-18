import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { SchoolProfileSettings } from "@/components/tenant/settings/profile";

/** The profile of the school: its mark, its name, and its address. */
export default async function SchoolProfilePage({
  params,
}: PageProps<"/[locale]/school/[slug]/settings/profile">) {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
    notFound();
  }
  return <SchoolProfileSettings slug={slug} />;
}
