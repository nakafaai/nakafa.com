import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { TenantSection } from "@/components/tenant/section";
import { firstSettingsTarget, opensSettingsRoute } from "@/lib/settings/school";

/**
 * The school settings. A viewer sees the sections their actions open, and any other section answers
 * not found. The settings root belongs to the viewer's first section.
 */
export const Route = createFileRoute("/school/$slug/settings")({
  beforeLoad: ({ context, matches }) => {
    const { school, slug } = context;
    if (school._tag !== "Member") {
      return;
    }
    const { reach } = school.viewer;
    const page = Option.getOrThrow(Arr.last(matches)).routeId;
    const atRoot = page === "/school/$slug/settings/";
    const opens = atRoot
      ? Option.isSome(firstSettingsTarget(slug, reach))
      : opensSettingsRoute(slug, reach, page);
    if (!opens) {
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
