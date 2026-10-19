"use client";

import { QueryResult } from "@confect/react";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option } from "effect";
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
import { useStudentSittings } from "@/components/tenant/home/query.client";
import { StaffHome } from "@/components/tenant/home/staff";
import { StudentHome } from "@/components/tenant/home/student";
import { HomeTitle } from "@/components/tenant/home/title";
import { orderSittings } from "@/components/tenant/sittings.client";

/**
 * Beranda of a school: one header with the page's one end-goal action for the viewer, a title row with Nina, and
 * the tiles of what the viewer must act on now. A student sees the student's sittings and results. A viewer who
 * watches rooms sees the rooms that run and open soon, the results to view, and the setup while it is open, and a
 * viewer who may create exams also sees the exams they started. The school's context carries the viewer's access,
 * which the layout computed on the server, so the header's action is in the first HTML. Each tile takes its rows
 * from one read, and the page passes no data down.
 */
export function TenantHome() {
  const tenant = useTenant();
  const [drafts] = useState(createExamDrafts);

  return (
    <HomePage action={<HomeAction drafts={drafts} />}>
      <HomeTitle />
      {tenant.role === "student" ? (
        <StudentHome />
      ) : (
        <StaffHome drafts={drafts} />
      )}
    </HomePage>
  );
}

/**
 * The one action of the header: Create exam for a viewer who may create, and Enter sitting for a student while a
 * sitting is open. A viewer with neither gets no action.
 */
function HomeAction({ drafts }: { drafts: StoreApi<ExamDrafts> }) {
  const tenant = useTenant();

  if (tenant.role === "student") {
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
    ? Arr.findFirst(
        orderSittings(listed.value),
        (sitting) => sitting.state === "open" && sitting.attempt !== "submitted"
      )
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
