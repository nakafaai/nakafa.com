import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { canOpenExams, canOpenRooms } from "@/components/tenant/exams/access";
import { TenantSection } from "@/components/tenant/section";

/** The exams of a school, for a viewer who may open exams or the rooms of one. */
export const Route = createFileRoute("/school/$slug/exams")({
  beforeLoad: ({ context }) => {
    const { school } = context;
    if (
      school._tag === "Member" &&
      !(canOpenExams(school.viewer) || canOpenRooms(school.viewer))
    ) {
      throw notFound();
    }
  },
  component: SchoolExamsLayout,
});

function SchoolExamsLayout() {
  return (
    <TenantSection section="exams">
      <Outlet />
    </TenantSection>
  );
}
