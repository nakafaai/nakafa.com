"use client";

import { QueryResult } from "@confect/react";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Option } from "effect";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import type { StoreApi } from "zustand";
import { LayoutContent } from "@/components/shared/content/layout";
import { useTenant } from "@/components/tenant/context";
import { CreateExam } from "@/components/tenant/exams/dialog";
import {
  createExamDrafts,
  type ExamDrafts,
} from "@/components/tenant/exams/drafts";
import { SchoolHeader } from "@/components/tenant/header";
import { showsStudentHome } from "@/components/tenant/home/access";
import {
  homeExamsRead,
  useStudentSittings,
} from "@/components/tenant/home/query.client";
import { StaffTiles } from "@/components/tenant/home/staff";
import { StudentHome } from "@/components/tenant/home/student";
import { HomeFailure } from "@/components/tenant/home/title";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import {
  enterableSitting,
  orderSittings,
} from "@/components/tenant/sittings.client";

/**
 * The home of a school: one header with the page's one end-goal action for the viewer, a title row with Nina, and
 * the tiles of what the viewer must act on now. A student sees the student's sittings and results. A viewer who
 * watches rooms sees the rooms that run and open soon, the results to view, and the setup while it is open, and a
 * viewer who may create exams also sees the exams they started. A member with no grant to create or watch sees the
 * student's view with its quiet state, because the staff tiles have nothing for them. The school's context carries
 * the viewer's access and the greeting, which the layout computed on the server, so Create exam and the title are
 * in the first HTML. A student's Enter sitting reads the student's sittings on the client, because a sitting opens
 * or closes while the page is open, so the action appears once that read answers. Each home reads its rows once,
 * and the tiles it shows take their rows from that read.
 */
export function TenantHome() {
  const tenant = useTenant();
  const [drafts] = useState(createExamDrafts);
  const studentView = showsStudentHome(tenant.role, tenant.home);

  return (
    <HomePage action={<HomeAction drafts={drafts} studentView={studentView} />}>
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
      languages={tenant.home.languages}
      slug={tenant.slug}
    />
  );
}

/** Enter sitting, which opens the first sitting that the student may still take, and shows only while one is open. */
function StudentAction() {
  const te = useTranslations("Exams");
  const listed = useStudentSittings();
  const open = QueryResult.isSuccess(listed)
    ? enterableSitting(orderSittings(listed.value))
    : Option.none();

  if (Option.isNone(open)) {
    return null;
  }
  return (
    <IntentLink
      className={buttonVariants()}
      href={`/sittings/${open.value.id}`}
      localized={false}
    >
      {te("student-enter")}
    </IntentLink>
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
