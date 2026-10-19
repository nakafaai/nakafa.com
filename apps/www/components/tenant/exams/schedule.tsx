"use client";

import { QueryResult, useQuery } from "@confect/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, DateTime, Effect, Option } from "effect";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  creatableUnits,
  type ViewerUnit,
} from "@/components/tenant/exams/create";
import { useExam } from "@/components/tenant/exams/provider";
import { nextQuarter } from "@/components/tenant/exams/time";

/**
 * The dialog that schedules a sitting. It loads on the first opening, so the editor's first page
 * does not carry the scheduling code.
 */
const ScheduleSitting = dynamic(
  () =>
    import("@/components/tenant/exams/sitting").then(
      (module) => module.ScheduleSitting
    ),
  { loading: () => null, ssr: false }
);

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
  const t = useTranslations("Exams");
  const { slug } = useExam();
  const viewer = useQuery(tenancy.viewer.get, { slug });
  const [openings, setOpenings] = useState(0);
  const [starts, setStarts] = useState("");
  const units = QueryResult.isSuccess(viewer)
    ? creatableUnits(viewer.value.units)
    : [];

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
        <Button aria-label={t("schedule")} onClick={open}>
          <HugeIcons aria-hidden="true" icon={Calendar03Icon} />
          <span className="max-sm:sr-only">{t("schedule")}</span>
        </Button>
      ) : null}
      {openings === 0 ? null : (
        <ScheduleSitting
          key={openings}
          onStartsChange={setStarts}
          starts={starts}
          units={units}
        />
      )}
    </>
  );
}
