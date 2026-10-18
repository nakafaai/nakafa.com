"use client";

import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { dashboardArgs } from "@/components/exams/sitting/change";
import {
  type SittingData,
  SittingDataContext,
  SittingStoreContext,
} from "@/components/exams/sitting/context";
import { SittingHeader } from "@/components/exams/sitting/header";
import { SittingPanel } from "@/components/exams/sitting/panel";
import { SittingSeats } from "@/components/exams/sitting/seats";
import { createSittingStore } from "@/components/exams/sitting/store";
import { SittingToolbar } from "@/components/exams/sitting/toolbar";

/**
 * The proctor's dashboard of one sitting: the room and the token, the filter row, the seats of
 * the students, and the panel of the selected student. A principal or a deputy sees the seats
 * and takes no action, because only a proctor may act (ADR 0013). The page of attempts is
 * read once, the first page, and the proctor's own changes show at once.
 */
export function SittingDashboard({
  examId,
  sittingId,
  slug,
}: {
  readonly examId: GenericId.GenericId<"exams">;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const [store] = useState(createSittingStore);
  const state = useQuery(
    exams.sittings.dashboard,
    dashboardArgs({ sittingId, slug })
  );

  if (QueryResult.isFailure(state)) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("sitting-unavailable")}
      </p>
    );
  }
  if (!QueryResult.isSuccess(state)) {
    return null;
  }
  if (state.value.sitting.examId !== examId) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("sitting-not-in-exam")}
      </p>
    );
  }

  const data: SittingData = {
    sittingId,
    slug,
    value: state.value,
  };

  return (
    <SittingStoreContext value={store}>
      <SittingDataContext value={data}>
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="grid min-w-0 flex-1 content-start gap-4">
            <SittingHeader />
            <SittingToolbar />
            <SittingSeats />
          </div>
          <SittingPanel />
        </div>
      </SittingDataContext>
    </SittingStoreContext>
  );
}
