"use client";

import { QueryResult } from "@confect/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LayoutContent } from "@/components/shared/content/layout";
import { useTenant } from "@/components/tenant/context";
import { CreateExam } from "@/components/tenant/exams/dialog";
import { createExamDrafts } from "@/components/tenant/exams/drafts";
import { SchoolHeader } from "@/components/tenant/header";
import { homeAccess } from "@/components/tenant/home/access";
import { DraftsTile } from "@/components/tenant/home/drafts";
import { LiveTile } from "@/components/tenant/home/live";
import { NextTile } from "@/components/tenant/home/next";
import { useHomeViewer } from "@/components/tenant/home/query.client";
import { StudentTile } from "@/components/tenant/home/student";
import { WelcomeTile } from "@/components/tenant/home/welcome";

/**
 * Beranda of a school: one header with the page's one end-goal action for the viewer, and a bento of
 * what the viewer must act on now. A student sees the student's sittings beside the welcome. A viewer
 * who may watch rooms sees the rooms that run and open soon, and a viewer who may create exams also
 * sees the exams they started. Each tile reads its own data, so the page passes no data down.
 */
export function TenantHome() {
  const tenant = useTenant();
  const tCommon = useTranslations("Common");
  const viewer = useHomeViewer();
  const [drafts] = useState(createExamDrafts);
  const access = QueryResult.isSuccess(viewer)
    ? homeAccess(viewer.value)
    : null;

  return (
    <>
      <SchoolHeader items={[]} title={tCommon("home")}>
        {access?.canCreate === true ? (
          <CreateExam
            choices={access.choices}
            drafts={drafts}
            languages={access.languages}
            slug={tenant.slug}
          />
        ) : null}
      </SchoolHeader>
      <LayoutContent className="w-full py-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <WelcomeTile className="md:col-span-2" />
          {tenant.role === "student" ? (
            <StudentTile className="md:col-span-2 xl:col-span-1" />
          ) : null}
          {access?.canWatch === true ? <LiveTile /> : null}
          {access?.canWatch === true ? <NextTile /> : null}
          {access?.canCreate === true ? (
            <DraftsTile className="md:col-span-2 xl:col-span-2" />
          ) : null}
        </div>
      </LayoutContent>
    </>
  );
}
