"use client";

import { QueryResult } from "@confect/react";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import type { StoreApi } from "zustand";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import type { ExamDrafts } from "@/components/tenant/exams/drafts";
import { Bento, type BentoTile } from "@/components/tenant/home/bento";
import { DraftsTile } from "@/components/tenant/home/drafts";
import { type StaffTile, staffPlan } from "@/components/tenant/home/layout";
import { LiveTile } from "@/components/tenant/home/live";
import { NextTile } from "@/components/tenant/home/next";
import {
  useHomeExams,
  useHomeSetup,
} from "@/components/tenant/home/query.client";
import { ResultsTile } from "@/components/tenant/home/results";
import { SetupTile, useSetupShown } from "@/components/tenant/home/setup";
import { HomeTitle } from "@/components/tenant/home/title";

/**
 * The title, the quiet line, and the tiles of a staff home, in the order and the places the plan gives them. One
 * read brings the rooms, the results, and the drafts, and the setup tile reads the school's setup on its own. Until
 * the reads that its tiles need have answered, only the title shows, and then the quiet line and every tile appear
 * at once, so no tile that is shown moves when another arrives. The home reads these tiles inside the read's
 * boundary, and the boundary's failure keeps the title.
 */
export function StaffTiles({ drafts }: { drafts: StoreApi<ExamDrafts> }) {
  const t = useTranslations("School");
  const tenant = useTenant();
  const exams = useHomeExams();
  const setup = useHomeSetup();
  const viewer = useViewerQuery();
  const setupShown = useSetupShown();

  if (QueryResult.isFailure(exams)) {
    throw exams.error;
  }
  // A failed read counts as an answer, because its tile shows its own failure. The owner's and the admin's setup
  // also waits for the viewer's units, which decide its first step.
  const setupAnswered =
    QueryResult.isSuccess(setup) || QueryResult.isFailure(setup);
  const viewerAnswered =
    QueryResult.isSuccess(viewer) || QueryResult.isFailure(viewer);
  const ready =
    QueryResult.isSuccess(exams) &&
    (!tenant.canManage || (setupAnswered && viewerAnswered));
  if (!ready) {
    return <HomeTitle />;
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
      <HomeTitle
        quiet={
          plan.quiet
            ? { act: "sleeping", sentence: t("quiet-staff") }
            : undefined
        }
      />
      <Bento
        tiles={Arr.map(
          plan.tiles,
          (tile): BentoTile => ({ key: tile, node: nodes[tile] })
        )}
      />
    </>
  );
}
