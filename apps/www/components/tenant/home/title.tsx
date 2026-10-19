"use client";

import { QueryResult } from "@confect/react";
import { Nina } from "@repo/design-system/components/ui/nina";
import { Array as Arr, DateTime, Option } from "effect";
import { useTranslations } from "next-intl";
import {
  DAY_PART_ACT,
  dayPartAt,
  firstNameOf,
} from "@/components/tenant/home/greeting";
import { useHomeViewer } from "@/components/tenant/home/query.client";

/**
 * The act of Nina before the school's clock is known: she does nothing in particular, so her pose never
 * changes after the first draw of a page that loads.
 */
const NEUTRAL_ACT = "relaxed";

/**
 * The greeting of the school home as a title row, not a card: Nina at 40 pixels beside "Good evening, {name}" at
 * 24 pixels. Nina acts for the part of the day on the school's clock, and the first unit of the school gives the
 * clock. The title line keeps its height while the viewer loads, so the page does not move when the name arrives.
 */
export function HomeTitle() {
  const t = useTranslations("School");
  const viewer = useHomeViewer();
  const part = QueryResult.isSuccess(viewer)
    ? dayPartAt(
        DateTime.nowUnsafe(),
        Option.flatMap(Arr.head(viewer.value.units), (unit) =>
          DateTime.zoneMakeNamed(unit.timeZone)
        )
      )
    : null;

  return (
    <div className="flex items-center gap-3">
      <Nina
        act={part === null ? NEUTRAL_ACT : DAY_PART_ACT[part]}
        label=""
        size={40}
        whole
      />
      <h2 className="min-h-8 font-medium text-2xl">
        {QueryResult.isSuccess(viewer) && part !== null
          ? t(`greeting-${part}`, {
              name: firstNameOf(viewer.value.person.name),
            })
          : null}
      </h2>
    </div>
  );
}
