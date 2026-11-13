import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { TenantSection } from "@/components/tenant/section";
import { opensSettingsPath } from "@/lib/settings/school";
import { guardSchoolPage } from "@/lib/tenant/guard";

/**
 * The school settings. A viewer sees the sections their actions open, and any other section answers
 * not found. The settings root belongs to the viewer's first section.
 */
export const Route = createFileRoute("/school/$slug/settings")({
  beforeLoad: guardSchoolPage({
    opens: (viewer, { pathname, slug }) =>
      opensSettingsPath(slug, viewer.reach, pathname),
  }),
  notFoundComponent: SchoolPageNotFound,
  component: SchoolSettingsLayout,
});

function SchoolSettingsLayout() {
  return (
    <TenantSection section="settings">
      <Outlet />
    </TenantSection>
  );
}
