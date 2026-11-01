import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import type { Option } from "effect";
import { canOpenExams } from "@/components/tenant/exams/access";
import {
  type HomeAccess,
  showsStudentHome,
} from "@/components/tenant/home/access";
import { canOpenReports } from "@/components/tenant/reports/access";
import { canManageSchool, roleOf, type SchoolViewer } from "@/lib/tenant/frame";

/**
 * The page a member's school opens on, by the member's main work there, as Vercel opens on a team's projects: the
 * exams for staff who may open them, the student's own exams for a student and for a member with no grant, then the
 * settings for a manager, the report cards for a teacher who keeps them, and the notifications otherwise.
 */
export function landingOf(
  viewer: {
    readonly canManage: boolean;
    readonly canOpenExams: boolean;
    readonly canOpenReports: boolean;
    readonly role: Option.Option<BuiltinRole>;
  },
  access: Pick<HomeAccess, "canCreate" | "canWatch">
) {
  if (viewer.canOpenExams) {
    return "/school/$slug/exams" as const;
  }
  if (showsStudentHome(viewer, access)) {
    return "/school/$slug/sittings" as const;
  }
  if (viewer.canManage) {
    return "/school/$slug/settings/profile" as const;
  }
  return viewer.canOpenReports
    ? ("/school/$slug/reports" as const)
    : ("/school/$slug/notifications" as const);
}

/** The page that a member lands on at the root of their school. */
export function memberLandingOf(member: {
  readonly home: HomeAccess;
  readonly viewer: Pick<SchoolViewer, "can" | "grants" | "units">;
}) {
  const { home, viewer } = member;
  return landingOf(
    {
      canManage: canManageSchool(viewer.can),
      canOpenExams: canOpenExams(viewer),
      canOpenReports: canOpenReports(viewer),
      role: roleOf(viewer.grants),
    },
    home
  );
}
