"use client";

import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useMediaQuery } from "@mantine/hooks";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import {
  Sheet,
  SheetHeader,
  SheetPopup,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
  AddMinutesDialog,
  AllowDeviceDialog,
  LockDialog,
  UnlockDialog,
} from "@/components/exams/sitting/dialogs";

/** The dialog of a panel action that is open, or none. */
type PanelDialog = "add-minutes" | "allow-device" | "lock" | "unlock";

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
 * The panel stays closed until a seat is selected.
 */
export function SittingPanel() {
  const t = useTranslations("Exams");
  const { sittingId, slug, value } = useSittingData();
  const selected = useSittingStore((state) => state.selected);
  const choose = useSittingStore((state) => state.choose);
  const isDesktop = useMediaQuery(TAILWIND_MEDIA_QUERIES.mdAndUp);
  // A seat on a later page reads that page, which the seats already subscribe to.
  const later = useQuery(
    exams.sittings.dashboard,
    selected === null || selected.cursor === null
      ? "skip"
      : dashboardArgs({ sittingId, slug }, selected.cursor)
  );
  const laterPage = QueryResult.isSuccess(later)
    ? later.value.attempts.page
    : [];
  const page = selected?.cursor === null ? value.attempts.page : laterPage;
  const current = Option.getOrUndefined(
    Arr.findFirst(page, (row) => row.id === selected?.attemptId)
  );

  /** Closes the panel by clearing the selection. */
  function close() {
    choose(null);
  }

  if (isDesktop) {
    if (current === undefined) {
      return null;
    }
    return (
      <aside
        aria-label={t("panel-label")}
        className="w-80 shrink-0 border-s p-4"
      >
        <StudentPanel attempt={current} onClose={close} />
      </aside>
    );
  }

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          close();
        }
      }}
      open={current !== undefined}
    >
      <SheetPopup side="bottom">
        <SheetHeader>
          <SheetTitle>{t("panel-label")}</SheetTitle>
        </SheetHeader>
        {current === undefined ? null : (
          <div className="px-4 pb-4">
            <StudentPanel attempt={current} onClose={close} />
          </div>
        )}
      </SheetPopup>
    </Sheet>
  );
}

/**
 * The content of the panel for one student. The actions follow the table of ADR 0013: a lock
 * for an attempt in progress, an unlock for a locked one, and added minutes for either. A
 * second device is allowed in every state. The actions show only when the page lists them for
 * the viewer, so a viewer who may only view sees the signals and no action.
 */
function StudentPanel({
  attempt,
  onClose,
}: {
  readonly attempt: DashboardAttempt;
  readonly onClose: () => void;
}) {
  const t = useTranslations("Exams");
  const tCommon = useTranslations("Common");
  const mayProctor = useMayProctor();
  const [dialog, setDialog] = useState<PanelDialog | null>(null);
  const takesMinutes =
    attempt.state === "inProgress" || attempt.state === "locked";

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <PersonAvatar className="size-9" mascot={attempt.mascot ?? undefined} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{attempt.name}</p>
          <p className="text-muted-foreground text-sm">
            {t(stateLabels[attempt.state])}
          </p>
        </div>
        <Button
          aria-label={tCommon("close")}
          onClick={onClose}
          size="icon"
          type="button"
          variant="ghost"
        >
          <HugeIcons icon={Cancel01Icon} />
        </Button>
      </div>
      <div className="grid gap-2">
        <p className="text-muted-foreground text-sm">{t("signals")}</p>
        <SignalList attemptId={attempt.id} key={attempt.id} />
      </div>
      {mayProctor ? (
        <div className="flex flex-wrap gap-2">
          {attempt.state === "inProgress" ? (
            <Button
              onClick={() => setDialog("lock")}
              size="sm"
              type="button"
              variant="destructive"
            >
              {t("lock")}
            </Button>
          ) : null}
          {attempt.state === "locked" ? (
            <Button
              onClick={() => setDialog("unlock")}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("unlock")}
            </Button>
          ) : null}
          {takesMinutes ? (
            <Button
              onClick={() => setDialog("add-minutes")}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("add-minutes")}
            </Button>
          ) : null}
          <Button
            onClick={() => setDialog("allow-device")}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("allow-device")}
          </Button>
        </div>
      ) : null}
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
    </div>
  );
}

/**
 * The signals of one attempt, newest first. A page loads as the list reaches its end, through an
 * intersection sentinel rather than a button, so the list grows as the proctor scrolls.
 */
function SignalList({
  attemptId,
}: {
  readonly attemptId: DashboardAttempt["id"];
}) {
  const t = useTranslations("Exams");
  const { slug, value } = useSittingData();
  const signals = usePaginatedQuery(
    exams.sittings.signals,
    { attemptId, sittingId: value.sitting.id, slug },
    { initialNumItems: SIGNAL_PAGE_SIZE }
  );

  if (PaginatedQueryResult.isFailure(signals)) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("sitting-unavailable")}
      </p>
    );
  }
  if (PaginatedQueryResult.isLoadingFirstPage(signals)) {
    return null;
  }

  return (
    <div className="grid gap-2 text-sm">
      {signals.results.length === 0 ? (
        <p className="text-muted-foreground">{t("signals-empty")}</p>
      ) : null}
      {Arr.map(signals.results, (signal) => (
        <p key={`${signal.at}-${signal.kind}`}>
          {t(signalLabels[signal.kind])}
        </p>
      ))}
      {PaginatedQueryResult.isCanLoadMore(signals) ? (
        <Intersection onIntersect={() => signals.loadMore(SIGNAL_PAGE_SIZE)} />
      ) : null}
    </div>
  );
}
