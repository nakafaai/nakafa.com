"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { LayoutContent } from "@/components/shared/content/layout";
import { useTenant } from "@/components/tenant/context";
import { CreateExam } from "@/components/tenant/exams/dialog";
import { createExamDrafts } from "@/components/tenant/exams/drafts";
import { SchoolHeader } from "@/components/tenant/header";
import { DraftsTile } from "@/components/tenant/home/drafts";
import { LiveTile } from "@/components/tenant/home/live";
import { NextTile } from "@/components/tenant/home/next";
import { StudentTile } from "@/components/tenant/home/student";
import { WelcomeTile } from "@/components/tenant/home/welcome";

/**
 * Beranda of a school: one header with the page's one end-goal action for the viewer, and a bento of
 * what the viewer must act on now. A student sees the student's sittings beside the welcome. A viewer
 * who may watch rooms sees the rooms that run and open soon, and a viewer who may create exams also
 * sees the exams they started. The school's context carries the viewer's access, which the layout
 * computed on the server, so the header's action and the tiles are in the first HTML and never insert
 * after hydration. Each tile reads its own rows, so the page passes no data down.
 */
export function TenantHome() {
  const tenant = useTenant();
  const [drafts] = useState(createExamDrafts);
  const { home } = tenant;

  return (
    <HomePage
      action={
        home.canCreate ? (
          <CreateExam
            choices={home.choices}
            drafts={drafts}
            languages={home.languages}
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
          {home.canWatch ? <LiveTile /> : null}
          {home.canWatch ? <NextTile /> : null}
          {home.canCreate ? (
            <DraftsTile
              className="md:col-span-2 xl:col-span-2"
              drafts={drafts}
            />
          ) : null}
        </div>
      }
    />
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
