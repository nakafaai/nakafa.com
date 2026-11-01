import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "cn";
import { Array as Arr, HashMap, Option } from "effect";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { dashboardArgs } from "@/components/exams/sitting/change";
import {
  type SittingData,
  SittingDataContext,
  SittingOfflineContext,
  SittingStoreContext,
} from "@/components/exams/sitting/context";
import { SittingHeader } from "@/components/exams/sitting/header";
import { SittingPanel } from "@/components/exams/sitting/panel";
import { SittingRetry } from "@/components/exams/sitting/retry";
import { SittingSeats } from "@/components/exams/sitting/seats";
import { createSittingStore } from "@/components/exams/sitting/store";
import { SittingFilterRow } from "@/components/exams/sitting/toolbar";
import type { BreadcrumbHeaderItem } from "@/components/shared/breadcrumb/header";
import { pageGutterVariants } from "@/components/shared/content/width";
import { Panes, PanesList, PanesProvider } from "@/components/shared/panes";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { ReadRecovery } from "@/components/tenant/read/recovery";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";
import { useLastValue } from "@/lib/data/kept";
import { Link } from "@/lib/routing/link";
import { schoolExamsTarget } from "@/lib/routing/school/target";

/**
 * The proctor's dashboard of one sitting: the page's header with the room, the token and the
 * seats' Filter menu, the seats of the students, and the panel of the selected student beside them. A principal or a deputy sees the seats
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
  // The dashboard needs the session, which Convex learns a moment after the page draws.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const state = useQuery(
    exams.sittings.dashboard,
    isSettled ? dashboardArgs({ sittingId, slug }, null) : "skip"
  );
  const kept = useLastValue(state);
  // Presence answers apart from the page: it changes only when a student's connection comes or goes.
  const silent = useLastValue(
    useQuery(exams.screens.offline, isSettled ? { sittingId, slug } : "skip")
  );
  const offline = useMemo(
    () =>
      HashMap.fromIterable(
        Arr.map(
          Option.getOrElse(silent, () => []),
          (seat) => [seat.attemptId, seat.since] as const
        )
      ),
    [silent]
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
      <SittingDashboardRetry>
        <SittingRetry error={state.error} />
      </SittingDashboardRetry>
    );
  }
  // A paused read, as while Convex confirms the session again, keeps its last answer, so the seats stay.
  if (Option.isNone(kept)) {
    // The header is there from the first paint, with the path the address knows; the room fills in when it is read.
    return <SittingDashboardShell />;
  }
  if (kept.value.sitting.examId !== examId) {
    return (
      <SittingRefusal examId={examId} message={t("sitting-not-in-exam")} />
    );
  }

  const data: SittingData = {
    sittingId,
    slug,
    value: kept.value,
  };

  return (
    <SittingStoreContext value={store}>
      <SittingDataContext value={data}>
        <PanesProvider>
          <SittingHeader examId={examId} />
          <SittingFilterRow />
          <SittingOfflineContext value={offline}>
            <Panes>
              <PanesList>
                <div
                  className={cn(
                    pageGutterVariants(),
                    "grid min-w-0 content-start gap-4 py-4 md:py-6"
                  )}
                >
                  <SittingSeats />
                </div>
              </PanesList>
              <SittingPanel />
            </Panes>
          </SittingOfflineContext>
        </PanesProvider>
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
  const examsItems: readonly BreadcrumbHeaderItem[] = tenant.canOpenExams
    ? [{ label: t("title"), target: schoolExamsTarget(tenant.slug) }]
    : [];

  return (
    <>
      <SchoolHeader items={[...examsItems, { label: t("sitting") }]} />
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

/**
 * The page while the dashboard is read: the school's header with the path to the exams, which the address and the
 * viewer already know, so the page has its header from the first paint. The page's own crumb stands empty, since a
 * header's last crumb is the page it stands on, and the exam's crumb, the room and the proctor's actions fill in at the
 * header's end when the room is read, so nothing that shows moves.
 */
function SittingDashboardShell() {
  const t = useTranslations("Exams");
  const tenant = useTenant();
  const examsItems: readonly BreadcrumbHeaderItem[] = tenant.canOpenExams
    ? [{ label: t("title"), target: schoolExamsTarget(tenant.slug) }]
    : [];

  return <SchoolHeader items={[...examsItems, { label: "" }]} />;
}

/**
 * Keeps a proctor on the room through a server failure of one of its reads: the page's header stays, and the seats
 * come back by themselves, so a room in full flow is not left on an error page that waits for a press.
 */
export function DashboardRecovery({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <ReadRecovery frame={SittingDashboardRetry} retry={SittingRetry}>
      {children}
    </ReadRecovery>
  );
}

/** The page when the dashboard could not be read for a reason a reload may fix: the header, then why and the retry. */
function SittingDashboardRetry({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <SittingDashboardShell />
      <div className="grid justify-items-start gap-4 p-4 text-sm md:p-6">
        {children}
      </div>
    </>
  );
}
