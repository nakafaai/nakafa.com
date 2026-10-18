import { ClassAddress } from "@repo/backend/confect/classroom/class";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import { notFound } from "next/navigation";
import { ClassShell } from "@/components/tenant/classes/shell";

/** The home of one class: its tabs, and the channels the class lists. An address that names no class answers not found. */
export default async function SchoolClassPage({
  params,
}: PageProps<"/[locale]/school/[slug]/classes/[classSlug]">) {
  const { classSlug, slug } = await params;
  const address = Schema.decodeOption(ClassAddress)(classSlug);
  const tenantSlug = Schema.decodeOption(TenantSlug)(slug);
  if (Option.isNone(address) || Option.isNone(tenantSlug)) {
    notFound();
  }
  return (
    <ClassShell classSlug={address.value} slug={tenantSlug.value} tab="home" />
  );
}
