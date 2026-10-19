"use client";

import { QueryResult } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
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
import { ReadBoundary } from "@/components/tenant/read/boundary";

/**
 * Beranda of a school: one header with the page's one end-goal action for the viewer, and a bento of
 * what the viewer must act on now. A student sees the student's sittings beside the welcome. A viewer
 * who may watch rooms sees the rooms that run and open soon, and a viewer who may create exams also
 * sees the exams they started. Each tile reads its own data, so the page passes no data down. The
 * viewer's own read is the one that gates the header and the tiles: when it fails, the page keeps its
 * header and offers Try again in place of the tiles.
 */
export function TenantHome() {
  const tenant = useTenant();

  return (
    <ReadBoundary
      fallback={(failure) => <HomePage body={failure} />}
      read={{ args: { slug: tenant.slug }, ref: tenancy.viewer.get }}
    >
      <HomeReady />
    </ReadBoundary>
  );
}

/** The header and the body of the school home, with the header's one action when the viewer has one. */
function HomePage({ action, body }: { action?: ReactNode; body: ReactNode }) {
  const tCommon = useTranslations("Common");

  return (
    <>
      <SchoolHeader items={[]} title={tCommon("home")}>
        {action}
      </SchoolHeader>
      <LayoutContent className="py-6">{body}</LayoutContent>
    </>
  );
}

/** The school home once the viewer's read is in: the create action and the tiles that the viewer may see. */
function HomeReady() {
  const tenant = useTenant();
  const viewer = useHomeViewer();
  const [drafts] = useState(createExamDrafts);

  if (QueryResult.isFailure(viewer)) {
    throw viewer.error;
  }
  const access = QueryResult.isSuccess(viewer)
    ? homeAccess(viewer.value)
    : null;

  return (
    <HomePage
      action={
        access?.canCreate === true ? (
          <CreateExam
            choices={access.choices}
            drafts={drafts}
            languages={access.languages}
            slug={tenant.slug}
          />
        ) : null
      }
      body={
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
      }
    />
  );
}
