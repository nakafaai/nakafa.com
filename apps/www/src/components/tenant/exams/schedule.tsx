import { QueryResult } from "@confect/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ClientOnly, lazyRouteComponent } from "@tanstack/react-router";
import { Array as Arr, DateTime, Effect, Option } from "effect";
import { type ComponentProps, Suspense, useState } from "react";
import { useTranslations } from "use-intl";
import { useViewerQuery } from "@/components/tenant/context";
import {
  creatableUnits,
  type ViewerUnit,
} from "@/components/tenant/exams/create";
import { nextQuarter } from "@/components/tenant/exams/time";

/**
 * The dialog that schedules a sitting. Its code stays out of the editor's first page, and loads
 * when the viewer reaches for the button, so a press opens the dialog at once.
 */
const ScheduleSitting = lazyRouteComponent(
  () => import("@/components/tenant/exams/sitting"),
  "ScheduleSitting"
);

/** Loads the dialog's code ahead of the press. */
const loadSchedule = () => ScheduleSitting.preload?.();

/**
 * The next whole quarter hour on the clock of a unit, as a `datetime-local` value. None when the
 * unit's time zone is not a named zone that the platform knows.
 */
const quarterOf = (unit: ViewerUnit, now: DateTime.Utc) =>
  Option.map(DateTime.zoneMakeNamed(unit.timeZone), (zone) =>
    nextQuarter(now, zone)
  );

/**
 * The button that schedules the exam. It shows only to a viewer who may schedule the exam in a
 * unit, as the exam list shows its create action. Each opening computes its default start, the
 * next whole quarter hour on the clock of the first unit, which the dialog selects first. Each
 * opening is a dialog of its own, so its fields start fresh.
 */
export function ScheduleExam() {
  const units = useSchedulingUnits();
  const [openings, setOpenings] = useState(0);
  const [starts, setStarts] = useState("");

  /** Opens a new dialog, whose start is computed now from the clock of the first unit. */
  const open = () => {
    const now = Effect.runSync(DateTime.now);
    setStarts(
      Option.getOrElse(
        Option.flatMap(Arr.head(units), (unit) => quarterOf(unit, now)),
        () => ""
      )
    );
    setOpenings((count) => count + 1);
  };

  return (
    <>
      {Arr.isReadonlyArrayNonEmpty(units) ? (
        <ScheduleButton
          onClick={open}
          onFocus={loadSchedule}
          onPointerEnter={loadSchedule}
        />
      ) : null}
      {openings === 0 ? null : (
        <Suspense fallback={null}>
          <ClientOnly fallback={null}>
            <ScheduleSitting
              key={openings}
              onStartsChange={setStarts}
              starts={starts}
              units={units}
            />
          </ClientOnly>
        </Suspense>
      )}
    </>
  );
}

/** Schedule before the exam is read, for a viewer who may schedule it: in its place, disabled. */
export function ScheduleExamFrame() {
  const units = useSchedulingUnits();

  return Arr.isReadonlyArrayNonEmpty(units) ? (
    <ScheduleButton disabled />
  ) : null;
}

/** The units in which the viewer may schedule an exam, none while the viewer is read. */
function useSchedulingUnits() {
  const viewer = useViewerQuery();
  return QueryResult.isSuccess(viewer)
    ? creatableUnits(viewer.value.units)
    : [];
}

/** Schedule, its icon and its words, the words for screen readers alone on a phone. */
function ScheduleButton(
  props: Pick<
    ComponentProps<typeof Button>,
    "disabled" | "onClick" | "onFocus" | "onPointerEnter"
  >
) {
  const t = useTranslations("Exams");

  return (
    <Button {...props} aria-label={t("schedule")}>
      <HugeIcons aria-hidden="true" icon={Calendar03Icon} />
      <span className="max-sm:sr-only">{t("schedule")}</span>
    </Button>
  );
}
