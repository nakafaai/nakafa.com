import { createFileRoute, redirect } from "@tanstack/react-router";
import { canOpenExams } from "@/components/tenant/exams/access";
import { canOpenReports } from "@/components/tenant/reports/access";
import { canManageSchool, roleOf } from "@/lib/tenant/frame";
import { landingOf } from "@/lib/tenant/landing";

/**
 * The root of a school host, which holds no page of its own: a member lands on the page of their main work there
 * (`landingOf`), decided in the browser from the frame the school layout already read, so the address changes before
 * anything draws and no Worker renders it. A visitor and an account that is not a member see the school's entry or
 * outsider page, which the layout draws in place of every page.
 */
export const Route = createFileRoute("/school/$slug/")({
  beforeLoad: ({ context, params }) => {
    const { school } = context;
    if (school._tag !== "Member") {
      return;
    }
    const { viewer } = school;
    throw redirect({
      params,
      replace: true,
      to: landingOf(
        {
          canManage: canManageSchool(viewer.can),
          canOpenExams: canOpenExams(viewer),
          canOpenReports: canOpenReports(viewer),
          role: roleOf(viewer.grants),
        },
        school.home
      ),
    });
  },
});
