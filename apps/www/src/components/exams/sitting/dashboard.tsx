import type { GenericId, Ref } from "@confect/core";
import { QueryResult } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
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
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";

/**
 * The proctor's dashboard of one sitting: the page's header with the room and the token, the
 * filter row, the seats of the students, and the panel of the selected student beside them. A principal or a deputy sees the seats
 * and takes no action, because only a proctor may act (ADR 0013). The page of attempts is
 * read once, the first page, and the proctor's own changes show at once.
 */
export function SittingDashboard({
  examId,
  preload,
  sittingId,
  slug,
}: {
  readonly examId: GenericId.GenericId<"exams">;
  readonly preload: Ref.Returns<typeof exams.sittings.dashboard> | undefined;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const [store] = useState(createSittingStore);
  // The dashboard needs the session, which Convex learns a moment after the page draws.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const state = usePreloadedQueryResult(
    exams.sittings.dashboard,
    isSettled ? dashboardArgs({ sittingId, slug }, null) : "skip",
    preload
  );

  if (QueryResult.isFailure(state)) {
    return <SittingRefusal message={t("sitting-unavailable")} />;
  }
  if (!QueryResult.isSuccess(state)) {
    return null;
  }
  if (state.value.sitting.examId !== examId) {
    return <SittingRefusal message={t("sitting-not-in-exam")} />;
  }

  const data: SittingData = {
    sittingId,
    slug,
    value: state.value,
  };

  return (
    <SittingStoreContext value={store}>
      <SittingDataContext value={data}>
        <SittingHeader examId={examId} />
        <div className="flex min-w-0 flex-1">
          <div className="grid min-w-0 flex-1 content-start gap-4 p-4 md:p-6">
            <SittingToolbar />
            <SittingSeats />
          </div>
          <SittingPanel />
        </div>
      </SittingDataContext>
    </SittingStoreContext>
  );
}

/**
 * The page when the dashboard cannot show the sitting: the header with the way back to the exams
 * for a viewer who may open them, and why.
 */
function SittingRefusal({ message }: { readonly message: string }) {
  const t = useTranslations("Exams");
  const tenant = useTenant();
  const examsItems = tenant.canOpenExams
    ? [{ href: "/exams", label: t("title") }]
    : [];

  return (
    <>
      <SchoolHeader items={examsItems} />
      <p className="p-4 text-muted-foreground text-sm md:p-6">{message}</p>
    </>
  );
}
