import { monospace } from "@repo/design-system/lib/monospace";
import { Outlet } from "@tanstack/react-router";
import { cn } from "cn";
import type { ReactElement } from "react";
import { AppProviders } from "@/components/providers/app";
import { canOpenExams } from "@/components/tenant/exams/access";
import { canOpenGraduation } from "@/components/tenant/graduation/access";
import { canOpenInsight } from "@/components/tenant/insight/access";
import { PageRecovery } from "@/components/tenant/read/recovery";
import { canOpenReports } from "@/components/tenant/reports/access";
import { TenantShell } from "@/components/tenant/shell";
import { canManageSchool, roleOf, type SchoolFrame } from "@/lib/tenant/frame";

/**
 * A member's school: the app's providers and the school shell around every page of the school. It
 * lives apart from the school layout, so a student who has not signed in yet loads none of it.
 */
export function SchoolMember({
  school,
}: {
  school: Extract<SchoolFrame, { _tag: "Member" }>;
}): ReactElement {
  const { viewer } = school;
  return (
    <AppProviders pageNavigation={null}>
      <TenantShell
        account={viewer.account}
        canManage={canManageSchool(viewer.can)}
        canOpenExams={canOpenExams(viewer)}
        canOpenGraduation={canOpenGraduation(viewer)}
        canOpenInsight={canOpenInsight(viewer)}
        canOpenReports={canOpenReports(viewer)}
        home={school.home}
        personName={viewer.person.name}
        profile={school.profile}
        reach={viewer.reach}
        role={roleOf(viewer.grants)}
        viewer={viewer}
      >
        <div className={cn(monospace, "contents")}>
          <PageRecovery>
            <Outlet />
          </PageRecovery>
        </div>
      </TenantShell>
    </AppProviders>
  );
}
