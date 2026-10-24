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
import { StaffTiles } from "@/components/tenant/home/staff";
import { StudentHome } from "@/components/tenant/home/student";
import { HomeFailure } from "@/components/tenant/home/title";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { enterableSitting, orderSittings } from "@/components/tenant/sittings";

/**
 * The home of a school: one header with the page's one end-goal action for the viewer, a title row with Nina, and
 * the tiles of what the viewer must act on now. A student sees the student's sittings and results. A viewer who
 * watches rooms sees the rooms that run and open soon, the results to view, and the setup while it is open, and a
 * viewer who may create exams also sees the exams they started. A member with no grant, who may neither create nor
 * watch, sees the student's view with its quiet state, because the staff tiles have nothing for them. Staff with a
 * role see the staff home, which holds only the tiles their actions allow. The school's context carries the viewer's
 * access and the greeting,
 * which the layout computed on the server, so Create exam and the title are
 * in the first HTML. A student's Enter sitting reads the student's sittings on the client, because a sitting opens
 * or closes while the page is open, so the action appears once that read answers. Each home reads its rows once,
 * and the tiles it shows take their rows from that read.
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
          <ReadBoundary
            fallback={(failure) => <HomeFailure failure={failure} />}
            read={homeExamsRead(tenant.slug)}
          >
            <StaffTiles drafts={drafts} />
          </ReadBoundary>
        )}
      </HomePage>
    </HomePreloadContext>
  );
}

/**
 * The one action of the header: Create exam for a viewer who may create, and Enter sitting for a student while a
 * sitting is open. A viewer with neither gets no action.
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

/** Enter sitting, which opens the first sitting that the student may still take, and shows only while one is open. */
function StudentAction() {
  const te = useTranslations("Exams");
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
      {te("student-enter")}
    </Link>
  );
}

/** The header and the body of the school home, with the header's one action when the viewer has one. */
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
      <SchoolHeader items={[]} title={tCommon("home")}>
        {action}
      </SchoolHeader>
      <LayoutContent className="w-full max-w-280 py-6">
        <div className="grid gap-6">{children}</div>
      </LayoutContent>
    </>
  );
}
