import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Schema } from "effect";
import { notFound } from "next/navigation";
import { TenantSection } from "@/components/tenant/section";
import { readViewer } from "@/lib/tenant/read";

/**
 * The layout of the school settings. Only a viewer who may manage the school
 * reads these pages: a signed-out viewer, a viewer who is not a member, and a
 * member without `tenant.manage` all get not found. The school shell mounts the
 * client providers that the settings pages need, and this layout keeps the pages
 * behind its own check of the viewer.
 *
 * The pages draw at once, and each query of them waits for Convex to settle the
 * session. The server read the session from the cookie, but a browser that has not
 * signed in on this school's host before learns of it one request after the page
 * loads, and a query sent before that would be refused as signed out.
 */
export default async function SchoolSettingsLayout({
  children,
  params,
}: LayoutProps<"/[locale]/school/[slug]/settings">) {
  const { slug: slugParam } = await params;
  if (!Schema.is(TenantSlug)(slugParam)) {
    notFound();
  }
  const viewer = await readViewer(slugParam);
  if (
    viewer._tag !== "member" ||
    !Arr.contains(viewer.viewer.can, "tenant.manage")
  ) {
    notFound();
  }

  return <TenantSection section="settings">{children}</TenantSection>;
}
