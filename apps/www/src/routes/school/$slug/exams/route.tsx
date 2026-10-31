import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { canOpenExams, canOpenRooms } from "@/components/tenant/exams/access";
import {
  CreatedExamsContext,
  createCreatedExams,
} from "@/components/tenant/exams/created";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
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
  notFoundComponent: SchoolPageNotFound,
});

/**
 * The pages of a school's exams. They share the store of the exams created in this visit, so the editor
 * that a create opens draws the new exam on its first frame.
 */
function SchoolExamsLayout() {
  const [created] = useState(createCreatedExams);

  return (
    <TenantSection section="exams">
      <CreatedExamsContext value={created}>
        <Outlet />
      </CreatedExamsContext>
    </TenantSection>
  );
}
