import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { TenantSection } from "@/components/tenant/section";

/** The school settings. Only a viewer who may manage the school sees them. */
export const Route = createFileRoute("/school/$slug/settings")({
  beforeLoad: ({ context }) => {
    const { school } = context;
    if (
      school._tag === "Member" &&
      !Arr.contains(school.viewer.can, "tenant.manage")
    ) {
      throw notFound();
    }
  },
  component: SchoolSettingsLayout,
});

function SchoolSettingsLayout() {
  return (
    <TenantSection section="settings">
      <Outlet />
    </TenantSection>
  );
}
