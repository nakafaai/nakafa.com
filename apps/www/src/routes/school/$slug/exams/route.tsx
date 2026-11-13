import { createFileRoute, Outlet } from "@tanstack/react-router";
import { canOpenExams, canOpenRooms } from "@/components/tenant/exams/access";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { TenantSection } from "@/components/tenant/section";
import { guardSchoolPage } from "@/lib/tenant/guard";

/** The exams of a school, for a viewer who may open exams or the rooms of one. */
export const Route = createFileRoute("/school/$slug/exams")({
  beforeLoad: guardSchoolPage({
    opens: (viewer) => canOpenExams(viewer) || canOpenRooms(viewer),
  }),
  notFoundComponent: SchoolPageNotFound,
  component: SchoolExamsLayout,
});

/** The pages of a school's exams, in the section that marks them in the sidebar. */
function SchoolExamsLayout() {
  return (
    <TenantSection section="exams">
      <Outlet />
    </TenantSection>
  );
}
