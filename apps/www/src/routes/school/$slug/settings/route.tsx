import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { TenantSection } from "@/components/tenant/section";
import { opensSettingsPath } from "@/lib/settings/school";

/**
 * The school settings. A viewer sees the sections their actions open, and any other section answers
 * not found. The settings root belongs to the viewer's first section.
 */
export const Route = createFileRoute("/school/$slug/settings")({
  beforeLoad: ({ context, location }) => {
    const { school, slug } = context;
    if (
      school._tag === "Member" &&
      !opensSettingsPath(slug, school.viewer.reach, location.pathname)
    ) {
      throw notFound();
    }
  },
  component: SchoolSettingsLayout,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolSettingsLayout() {
  return (
    <TenantSection section="settings">
      <Outlet />
    </TenantSection>
  );
}
