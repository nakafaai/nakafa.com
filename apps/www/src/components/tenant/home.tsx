import { LayoutContent } from "@/components/shared/content/frame";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { showsStudentHome } from "@/components/tenant/home/access";
import { HomeClock } from "@/components/tenant/home/clock";
import { homeExamsRead } from "@/components/tenant/home/query";
import { StaffHome } from "@/components/tenant/home/staff";
import { StudentHome } from "@/components/tenant/home/student";
import { HomeGreeting } from "@/components/tenant/home/title";
import { ReadBoundary } from "@/components/tenant/read/boundary";

/**
 * The home of a school: the viewer's own desk, never a report of one feature. Its header is the greeting alone, with no
 * page action, because an action belongs beside what it acts on. Its body holds at most three sections for the
 * viewer's role. A student sees the student's exams, classes and the school's updates. Staff see the rooms they watch
 * now, their classes, the setup while the school is not set up, and the updates. A member with no grant, who may
 * neither create nor watch, sees the student's home. The school's context carries the viewer's access and the
 * greeting, so the header draws with the first frame.
 */
export function TenantHome() {
  const tenant = useTenant();

  return (
    <HomeClock>
      <SchoolHeader heading={<HomeGreeting />} items={[]} />
      <LayoutContent className="w-full py-6" width="page">
        {showsStudentHome(tenant, tenant.home) ? (
          <StudentHome />
        ) : (
          <ReadBoundary read={homeExamsRead(tenant.slug)}>
            <StaffHome />
          </ReadBoundary>
        )}
      </LayoutContent>
    </HomeClock>
  );
}
