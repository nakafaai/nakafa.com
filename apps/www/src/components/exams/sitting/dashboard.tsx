import type { GenericId, Ref } from "@confect/core";
import { QueryResult } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { buttonVariants } from "@repo/design-system/lib/button";
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
import { SittingRetry } from "@/components/exams/sitting/retry";
import { SittingSeats } from "@/components/exams/sitting/seats";
import { createSittingStore } from "@/components/exams/sitting/store";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";
import { Link } from "@/lib/routing/link";

/**
 * The proctor's dashboard of one sitting: the page's header with the room, the token and the
 * seats' Filter menu, the seats of the students, and the panel of the selected student beside them. A principal or a deputy sees the seats
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
    if (isLostAccess(state.error)) {
      throw state.error;
    }
    // A room cancelled, or an exam deleted, elsewhere is refused like a foreign one, and leads back to the exam's
    // rooms. Any other failure is one a reload may fix.
    return isDenied(state.error) ? (
      <SittingRefusal examId={examId} message={t("sitting-unavailable")} />
    ) : (
      <SittingDashboardRetry error={state.error} />
    );
  }
  if (!QueryResult.isSuccess(state)) {
    return null;
  }
  if (state.value.sitting.examId !== examId) {
    return (
      <SittingRefusal examId={examId} message={t("sitting-not-in-exam")} />
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
        <SittingHeader examId={examId} />
        <div className="flex min-w-0 flex-1">
          <div className="grid min-w-0 flex-1 content-start gap-4 p-4 md:p-6">
            <SittingSeats />
          </div>
          <SittingPanel />
        </div>
      </SittingDataContext>
    </SittingStoreContext>
  );
}

/**
 * The page when the proctor may not view the sitting: the school's header, why, and the way to the exam's rooms,
 * which a viewer who may open the exams has.
 */
function SittingRefusal({
  examId,
  message,
}: {
  readonly examId: GenericId.GenericId<"exams">;
  readonly message: string;
}) {
  const t = useTranslations("Exams");
  const tenant = useTenant();
  const examsItems = tenant.canOpenExams
    ? [{ href: "/exams", label: t("title") }]
    : [];

  return (
    <>
      <SchoolHeader items={examsItems} />
      <div className="grid justify-items-start gap-4 p-4 md:p-6">
        <p className="text-muted-foreground text-sm">{message}</p>
        {tenant.canOpenExams ? (
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            params={{ exam: examId, slug: tenant.slug }}
            to="/school/$slug/exams/$exam"
          >
            {t("rooms-title")}
          </Link>
        ) : null}
      </div>
    </>
  );
}

/** The page when the dashboard could not be read for a reason a reload may fix: the header, why, and the retry. */
function SittingDashboardRetry({ error }: { readonly error: unknown }) {
  return (
    <>
      <SchoolHeader items={[]} />
      <div className="grid justify-items-start gap-4 p-4 text-sm md:p-6">
        <SittingRetry error={error} />
      </div>
    </>
  );
}
