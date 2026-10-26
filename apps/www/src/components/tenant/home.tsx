import { QueryResult } from "@confect/react";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Option } from "effect";
import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";
import type { StoreApi } from "zustand";
import { LayoutContent } from "@/components/shared/content/frame";
import { useTenant } from "@/components/tenant/context";
import { CreateExam } from "@/components/tenant/exams/dialog";
import {
  createExamDrafts,
  type ExamDrafts,
} from "@/components/tenant/exams/drafts";
import { SchoolHeader } from "@/components/tenant/header";
import { showsStudentHome } from "@/components/tenant/home/access";
import { HomeClock } from "@/components/tenant/home/clock";
import {
  type HomePreload,
  HomePreloadContext,
} from "@/components/tenant/home/data";
import {
  homeExamsRead,
  useStudentSittings,
} from "@/components/tenant/home/query";
import { createHomeReleases } from "@/components/tenant/home/release";
import { StaffHome } from "@/components/tenant/home/staff";
import { StudentHome } from "@/components/tenant/home/student";
import { HomeGreeting } from "@/components/tenant/home/title";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { enterableSitting, orderSittings } from "@/components/tenant/sittings";
import { TargetLink } from "@/lib/routing/link";
import { schoolSittingTarget } from "@/lib/routing/school/target";

/**
 * The home of a school: a header row with the greeting as its heading and the page's one end-goal action at its end,
 * and below it one connected dashboard of what the viewer must act on now. A student sees the student's sittings and
 * results. A viewer who watches rooms sees the numbers of the rooms that run and open soon, their schedule, the results
 * to view, and the setup while it is open, and a viewer who may create exams also sees the exams they started. A member
 * with no grant, who may neither create nor watch, sees the student's view with its quiet state, because the staff
 * cells have nothing for them. Staff with a role see the staff home, which holds only the cells their actions allow,
 * since the student's sentence is not theirs. The school's context carries the viewer's access, and the loader carries
 * the greeting and the server's time, so the action, the greeting and the times are in the first HTML. Each home reads
 * its rows once, and its cells take their rows from that read.
 */
export function TenantHome({ preload }: { preload: HomePreload }) {
  const tenant = useTenant();
  const [drafts] = useState(createExamDrafts);
  const [releases] = useState(createHomeReleases);
  const studentView = showsStudentHome(tenant, tenant.home);
  const serverNow = preload.serverNow;

  // The loader reads no home for a viewer who is not a member, so no home shows for that viewer.
  if (serverNow === undefined) {
    return null;
  }
  return (
    <HomePreloadContext value={preload}>
      <HomeClock key={serverNow} serverNow={serverNow}>
        <HomePage
          action={<HomeAction drafts={drafts} studentView={studentView} />}
        >
          {studentView ? (
            <StudentHome />
          ) : (
            <ReadBoundary read={homeExamsRead(tenant.slug)}>
              <StaffHome drafts={drafts} releases={releases} />
            </ReadBoundary>
          )}
        </HomePage>
      </HomeClock>
    </HomePreloadContext>
  );
}

/**
 * The one action of the header row: Create exam for a viewer who may create, and Start exam or Continue for a
 * student while a sitting is open. A viewer with neither gets no action.
 */
function HomeAction({
  drafts,
  studentView,
}: {
  drafts: StoreApi<ExamDrafts>;
  studentView: boolean;
}) {
  const tenant = useTenant();

  if (studentView) {
    return <StudentAction />;
  }
  if (!tenant.home.canCreate) {
    return null;
  }
  return (
    <CreateExam
      choices={tenant.home.choices}
      drafts={drafts}
      slug={tenant.slug}
    />
  );
}

/**
 * Start exam, which opens the first sitting that the student may still take, and Continue once the student has an
 * attempt in it. It shows only while a sitting is open.
 */
function StudentAction() {
  const te = useTranslations("Exams");
  const tCommon = useTranslations("Common");
  const { slug } = useTenant();
  const listed = useStudentSittings();
  const open = QueryResult.isSuccess(listed)
    ? enterableSitting(orderSittings(listed.value))
    : Option.none();

  if (Option.isNone(open)) {
    return null;
  }
  return (
    <TargetLink
      className={buttonVariants()}
      target={schoolSittingTarget(slug, open.value.id)}
    >
      {open.value.attempt === null ? te("student-start") : tCommon("continue")}
    </TargetLink>
  );
}

/** The header row and the dashboard of the school home, in the page's one column of content. */
function HomePage({
  action,
  children,
}: {
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <SchoolHeader heading={<HomeGreeting />} items={[]}>
        {action}
      </SchoolHeader>
      <LayoutContent className="w-full max-w-7xl py-6">
        {children}
      </LayoutContent>
    </>
  );
}
