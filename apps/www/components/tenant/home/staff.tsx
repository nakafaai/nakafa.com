"use client";

import { QueryResult } from "@confect/react";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { StoreApi } from "zustand";
import { useTenant } from "@/components/tenant/context";
import type { ExamDrafts } from "@/components/tenant/exams/drafts";
import { Bento, type BentoTile } from "@/components/tenant/home/bento";
import { DraftsTile } from "@/components/tenant/home/drafts";
import { type StaffTile, staffPlan } from "@/components/tenant/home/layout";
import { LiveTile } from "@/components/tenant/home/live";
import { NextTile } from "@/components/tenant/home/next";
import {
  homeExamsRead,
  useHomeExams,
} from "@/components/tenant/home/query.client";
import { QuietState } from "@/components/tenant/home/quiet";
import { ResultsTile } from "@/components/tenant/home/results";
import { SetupTile, useSetupShown } from "@/components/tenant/home/setup";
import { ReadBoundary } from "@/components/tenant/read/boundary";

/**
 * The home of a viewer who watches rooms or creates exams. The rooms, results, and drafts load into their tiles,
 * and the setup tile reads the school's setup. While the rooms load, the quiet state holds the place of Live and
 * Next, so the page does not move when they answer.
 */
export function StaffHome({ drafts }: { drafts: StoreApi<ExamDrafts> }) {
  const tenant = useTenant();

  return (
    <ReadBoundary read={homeExamsRead(tenant.slug)}>
      <StaffTiles drafts={drafts} />
    </ReadBoundary>
  );
}

/** The quiet state and the tiles of a staff home, in the order and the places the plan gives them. */
function StaffTiles({ drafts }: { drafts: StoreApi<ExamDrafts> }) {
  const t = useTranslations("School");
  const tenant = useTenant();
  const exams = useHomeExams();
  const setupShown = useSetupShown();

  if (QueryResult.isFailure(exams)) {
    throw exams.error;
  }
  if (!QueryResult.isSuccess(exams)) {
    return tenant.home.canWatch ? (
      <QuietState act="sleeping">{""}</QuietState>
    ) : null;
  }
  const { closed, drafts: draftRows, live, next } = exams.value;
  const plan = staffPlan({
    canCreate: tenant.home.canCreate,
    canWatch: tenant.home.canWatch,
    closed: closed.length,
    drafts: draftRows.length,
    live: live.length,
    next: next.length,
    setup: setupShown,
  });
  const nodes: Record<StaffTile, ReactNode> = {
    drafts: <DraftsTile className="h-full" drafts={draftRows} store={drafts} />,
    live: <LiveTile className="h-full" rooms={live} />,
    next: <NextTile className="h-full" rooms={next} />,
    results: <ResultsTile className="h-full" results={closed} />,
    setup: <SetupTile className="h-full" />,
  };

  return (
    <>
      {plan.quiet ? (
        <QuietState act="sleeping">{t("quiet-staff")}</QuietState>
      ) : null}
      <Bento
        tiles={Arr.map(
          plan.tiles,
          (tile): BentoTile => ({ key: tile, node: nodes[tile] })
        )}
      />
    </>
  );
}
