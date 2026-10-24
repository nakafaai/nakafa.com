import { QueryResult } from "@confect/react";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Link } from "@repo/internationalization/src/link";
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
import {
  type HomePreload,
  HomePreloadContext,
} from "@/components/tenant/home/data";
import {
  homeExamsRead,
  useStudentSittings,
} from "@/components/tenant/home/query";
import { StaffHome } from "@/components/tenant/home/staff";
import { StudentHome } from "@/components/tenant/home/student";
import { HomeTitle } from "@/components/tenant/home/title";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { enterableSitting, orderSittings } from "@/components/tenant/sittings";

/**
 * The home of a school: a header row with the greeting as its title and the page's one end-goal action at its end,
 * and below it the cells of what the viewer must act on now, on one connected dashboard. A student sees the
 * student's sittings and results. A viewer who watches rooms sees the numbers of the rooms that run and open soon,
 * their schedule, the results to view, and the setup while it is open, and a viewer who may create exams also sees
 * the exams they started. A member with no grant, who may neither create nor watch, sees the student's view with its
 * quiet state, because the staff cells have nothing for them. Staff with a role see the staff home, which holds only
 * the cells their actions allow, since the student's sentence is not theirs. The school's context carries the
 * viewer's access and the greeting, which the layout computed on the server, so the action and the title are in the
 * first HTML. Each home reads its rows once, and its cells take their rows from that read.
 */
export function TenantHome({ preload }: { preload: HomePreload }) {
  const tenant = useTenant();
  const [drafts] = useState(createExamDrafts);
  const studentView = showsStudentHome(tenant, tenant.home);

  return (
    <HomePreloadContext value={preload}>
      <HomePage
        action={<HomeAction drafts={drafts} studentView={studentView} />}
      >
        {studentView ? (
          <StudentHome />
        ) : (
          <ReadBoundary read={homeExamsRead(tenant.slug)}>
            <StaffHome drafts={drafts} />
          </ReadBoundary>
        )}
      </HomePage>
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
      languages={tenant.home.languages}
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
    <Link
      className={buttonVariants()}
      params={{ sitting: open.value.id, slug }}
      to="/school/$slug/sittings/$sitting"
    >
      {open.value.attempt === null ? te("student-start") : tCommon("continue")}
    </Link>
  );
}

/** The header row and the cells of the school home, in the page's one column of content. */
function HomePage({
  action,
  children,
}: {
  action: ReactNode;
  children: ReactNode;
}) {
  const tCommon = useTranslations("Common");

  return (
    <>
      <SchoolHeader items={[]} title={tCommon("home")} />
      <LayoutContent className="w-full max-w-6xl py-6">
        <div className="grid gap-6">
          <HomeTitle action={action} />
          {children}
        </div>
      </LayoutContent>
    </>
  );
}
