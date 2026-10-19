import { ClassAddress } from "@repo/backend/confect/classroom/class";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import { notFound } from "next/navigation";
import { ClassShell } from "@/components/tenant/classes/shell";

/** The forum of one class: its channels, and the add that a teacher or an Admin makes. An address that names no class answers not found. */
export default async function SchoolClassForumPage({
  params,
}: PageProps<"/[locale]/school/[slug]/classes/[classSlug]/forum">) {
  const { classSlug, slug } = await params;
  const address = Schema.decodeOption(ClassAddress)(classSlug);
  const tenantSlug = Schema.decodeOption(TenantSlug)(slug);
  if (Option.isNone(address) || Option.isNone(tenantSlug)) {
    notFound();
  }
  return (
    <ClassShell classSlug={address.value} slug={tenantSlug.value} tab="forum" />
  );
}
