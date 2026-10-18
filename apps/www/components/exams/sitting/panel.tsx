"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useMediaQuery } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
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
import type { DashboardAttempt } from "@/components/exams/sitting/change";
import {
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
 * The panel of the selected student: a side column on a wide screen, and a sheet on a phone.
 * It shows the student's state, the latest signal, and the actions that the proctor may take.
 * The panel stays closed until a seat is selected.
 */
export function SittingPanel() {
  const t = useTranslations("Exams");
  const { value } = useSittingData();
  const selected = useSittingStore((state) => state.selected);
  const choose = useSittingStore((state) => state.choose);
  const isDesktop = useMediaQuery(TAILWIND_MEDIA_QUERIES.mdAndUp);
  const current = Option.getOrUndefined(
    Arr.findFirst(value.attempts.page, (row) => row.id === selected)
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
        className="w-80 shrink-0 self-start rounded-xl border bg-card p-4"
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
 * second device is allowed in every state. A viewer who may only view takes no action.
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
  const { canProctor } = useSittingData();
  const [dialog, setDialog] = useState<PanelDialog | null>(null);
  const takesMinutes =
    attempt.state === "inProgress" || attempt.state === "locked";
  const latest = attempt.latestSignal;

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
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("signals")}</dt>
        <dd>
          {latest === null ? t("signals-empty") : t(signalLabels[latest.kind])}
        </dd>
      </dl>
      {canProctor ? (
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
