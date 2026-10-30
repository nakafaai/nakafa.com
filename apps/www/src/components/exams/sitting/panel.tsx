import { PaginatedQueryResult, QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { awayFor } from "@repo/backend/confect/exams/sittings/away";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { getRouteApi } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  type DashboardAttempt,
  dashboardArgs,
} from "@/components/exams/sitting/change";
import {
  useMayProctor,
  useSittingData,
  useSittingStore,
} from "@/components/exams/sitting/context";
import {
  type PanelDialog,
  StudentPanelActions,
} from "@/components/exams/sitting/controls";
import {
  AddMinutesDialog,
  AllowDeviceDialog,
  LockDialog,
  UnlockDialog,
} from "@/components/exams/sitting/dialogs";
import { StudentScreen } from "@/components/exams/sitting/screen";
import { DataFailure } from "@/components/shared/failure";
import { PaneBody, PaneFooter, PaneHeader } from "@/components/shared/pane";
import { PanesDetail } from "@/components/shared/panes";
import { reloadPage } from "@/components/shared/reload";
import { TableEmpty } from "@/components/shared/table/frame";
import { isLostAccess } from "@/components/tenant/refusal";
import { usePaginatedPreloaded } from "@/lib/data/paginated";

/** The proctor's dashboard, whose address holds the seat the proctor selected. */
const dashboardRoute = getRouteApi(
  "/school/$slug/exams/$exam/sittings/$sitting/"
);

/** How many signals one page of the panel's list holds, the first one and each one after it. */
const SIGNAL_PAGE_SIZE = 20;

/** The copy key of each state of an attempt, as the panel names it. */
const stateLabels: Record<
  DashboardAttempt["state"],
  "state-closing" | "state-in-progress" | "state-locked" | "state-submitted"
> = {
  closing: "state-closing",
  inProgress: "state-in-progress",
  locked: "state-locked",
  submitted: "state-submitted",
};

/** The copy key of each signal of a student's screen, as the panel names it. */
/** The seconds of one minute, which a long time away is told in. */
const SECONDS_IN_MINUTE = 60;

const signalLabels: Record<
  NonNullable<DashboardAttempt["latestSignal"]>["kind"],
  | "signal-blur"
  | "signal-copy"
  | "signal-disconnect"
  | "signal-exit"
  | "signal-fullscreenExit"
  | "signal-paste"
  | "signal-return"
  | "signal-secondTab"
> = {
  blur: "signal-blur",
  copy: "signal-copy",
  disconnect: "signal-disconnect",
  exit: "signal-exit",
  fullscreenExit: "signal-fullscreenExit",
  paste: "signal-paste",
  return: "signal-return",
  secondTab: "signal-secondTab",
};

/**
 * The panel of the selected student: a pane along the page's right edge on a wide screen, beside
 * the seats it leaves in view, and a sheet on a phone.
 * It shows the student's state, the latest signal, and the actions that the proctor may take.
 * The panel stays closed until a seat is selected. The seat the reader is on reads the panel's
 * data first, so the panel opens with its signals already on screen.
 */
export function SittingPanel() {
  return (
    <>
      <WarmedSeat />
      <SelectedPanel />
    </>
  );
}

/** The panel of the seat that the address selects, which holds the seat's panel data as it opens. */
function SelectedPanel() {
  const t = useTranslations("Exams");
  const { sittingId, slug, value } = useSittingData();
  const { page: cursor, seat } = dashboardRoute.useSearch();
  const navigate = dashboardRoute.useNavigate();
  // A seat on a later page reads that page, which the seats already subscribe to.
  const later = useQuery(
    exams.sittings.dashboard,
    seat === undefined || cursor === undefined
      ? "skip"
      : dashboardArgs({ sittingId, slug }, cursor)
  );
  const laterPage = QueryResult.isSuccess(later)
    ? later.value.attempts.page
    : [];
  const page = cursor === undefined ? value.attempts.page : laterPage;
  const current = Option.getOrUndefined(
    Arr.findFirst(page, (row) => row.id === seat)
  );

  return (
    <PanesDetail
      empty={t("panel-empty")}
      label={t("panel-label")}
      onClose={() =>
        navigate({ replace: true, resetScroll: false, search: {} })
      }
      open={current !== undefined}
    >
      {current === undefined ? null : <StudentPanel attempt={current} />}
    </PanesDetail>
  );
}

/**
 * The content of the panel for one student. The actions follow the table of ADR 0013 (see
 * `StudentPanelActions`), and show only when the page lists them for the viewer, so a viewer who
 * may only view sees the signals and no action.
 */
function StudentPanel({ attempt }: { readonly attempt: DashboardAttempt }) {
  const t = useTranslations("Exams");
  const mayProctor = useMayProctor();

  return (
    <>
      <PaneHeader
        description={t(stateLabels[attempt.state])}
        title={attempt.name}
      />
      <PaneBody>
        <div className="grid gap-4">
          <StudentScreen attemptId={attempt.id} key={`screen-${attempt.id}`} />
          <div className="grid gap-2">
            <p className="text-muted-foreground text-sm">{t("signals")}</p>
            <SignalList attemptId={attempt.id} key={attempt.id} />
          </div>
        </div>
      </PaneBody>
      {mayProctor ? (
        <PaneFooter>
          <StudentActions attempt={attempt} />
        </PaneFooter>
      ) : null}
    </>
  );
}

/** A proctor's actions on one student (see `StudentPanelActions`) and the dialog each one opens. */
function StudentActions({ attempt }: { readonly attempt: DashboardAttempt }) {
  const [dialog, setDialog] = useState<PanelDialog | null>(null);

  return (
    <>
      <StudentPanelActions
        name={attempt.name}
        onOpen={setDialog}
        state={attempt.state}
      />
      <LockDialog
        attemptId={attempt.id}
        name={attempt.name}
        onOpenChange={(next) => setDialog(next ? "lock" : null)}
        open={dialog === "lock"}
      />
      <UnlockDialog
        attemptId={attempt.id}
        name={attempt.name}
        onOpenChange={(next) => setDialog(next ? "unlock" : null)}
        open={dialog === "unlock"}
      />
      <AddMinutesDialog
        attemptId={attempt.id}
        name={attempt.name}
        onOpenChange={(next) => setDialog(next ? "add-minutes" : null)}
        open={dialog === "add-minutes"}
      />
      <AllowDeviceDialog
        attemptId={attempt.id}
        name={attempt.name}
        onOpenChange={(next) => setDialog(next ? "allow-device" : null)}
        open={dialog === "allow-device"}
      />
    </>
  );
}

/**
 * The seat the reader is on reads what its panel shows, so the panel's first frame has it. A seat
 * on a later page reads that page too, which the panel reads when it opens.
 */
function WarmedSeat() {
  const onSeat = useSittingStore((state) => state.onSeat);
  if (onSeat === null) {
    return null;
  }
  // A read that fails here stays out of the page: the panel reads the same data when it opens.
  return (
    <ErrorBoundary fallback={null} key={onSeat.attemptId} report={false}>
      <SeatPanelData attemptId={onSeat.attemptId} cursor={onSeat.cursor} />
    </ErrorBoundary>
  );
}

/** Subscribes to one seat's panel data without rendering it. */
function SeatPanelData({
  attemptId,
  cursor,
}: {
  readonly attemptId: DashboardAttempt["id"];
  readonly cursor: string | null;
}) {
  const { sittingId, slug } = useSittingData();
  useQuery(
    exams.sittings.dashboard,
    cursor === null ? "skip" : dashboardArgs({ sittingId, slug }, cursor)
  );
  useFirstSignalPage(attemptId);
  return null;
}

/**
 * The first page of one attempt's signals, read by a plain query. A plain query with the same
 * arguments shares its subscription, so a seat that warmed it already has the page when the panel
 * reads it. A paginated query keeps its own page per instance, so the list cannot share it.
 */
function useFirstSignalPage(attemptId: DashboardAttempt["id"]) {
  const { slug, value } = useSittingData();
  return useQuery(exams.sittings.signals, {
    attemptId,
    paginationOpts: { cursor: null, numItems: SIGNAL_PAGE_SIZE },
    sittingId: value.sitting.id,
    slug,
  });
}

/**
 * The signals of one attempt, newest first. The first page is the one the seat read on intent, so
 * the list is complete when the panel opens. A page loads as the list reaches its end, through an
 * intersection sentinel rather than a button, so the list grows as the proctor scrolls.
 */
function SignalList({
  attemptId,
}: {
  readonly attemptId: DashboardAttempt["id"];
}) {
  const t = useTranslations("Exams");
  const { slug, value } = useSittingData();
  const firstPage = useFirstSignalPage(attemptId);
  const signals = usePaginatedPreloaded(
    exams.sittings.signals,
    { attemptId, sittingId: value.sitting.id, slug },
    { initialNumItems: SIGNAL_PAGE_SIZE },
    QueryResult.isSuccess(firstPage)
      ? Option.some(firstPage.value)
      : Option.none()
  );

  if (PaginatedQueryResult.isFailure(signals) && isLostAccess(signals.error)) {
    throw signals.error;
  }
  if (PaginatedQueryResult.isLoadingFirstPage(signals)) {
    return null;
  }
  const failed = PaginatedQueryResult.isFailure(signals);

  return (
    <div className="grid gap-2 text-sm">
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      {Arr.isReadonlyArrayEmpty(signals.results) && !failed ? (
        <TableEmpty
          act="reading"
          description={t("signals-empty")}
          title={t("signals-empty-title")}
        />
      ) : null}
      {Arr.map(signals.results, (signal) => (
        <p key={`${signal.at}-${signal.kind}`}>
          {signal.kind === "exit"
            ? Option.match(awayFor(signals.results, signal), {
                onNone: () => t(signalLabels[signal.kind]),
                onSome: (seconds) =>
                  seconds < SECONDS_IN_MINUTE
                    ? t("signal-away-seconds", { seconds })
                    : t("signal-away-minutes", {
                        minutes: Math.floor(seconds / SECONDS_IN_MINUTE),
                        seconds: seconds % SECONDS_IN_MINUTE,
                      }),
              })
            : t(signalLabels[signal.kind])}
        </p>
      ))}
      {PaginatedQueryResult.isCanLoadMore(signals) ? (
        <Intersection onIntersect={() => signals.loadMore(SIGNAL_PAGE_SIZE)} />
      ) : null}
    </div>
  );
}
