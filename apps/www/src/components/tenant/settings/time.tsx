import { QueryResult } from "@confect/react";
import { Array as Arr, DateTime, Option } from "effect";
import { useLocale } from "use-intl";
import { useViewerQuery } from "@/components/tenant/context";
import { schoolDateTimeText } from "@/components/tenant/settings/clock";

/** The time zone of the school's clock: its first active unit's, or none until the school is read. */
export function useSchoolTimeZone() {
  const viewer = useViewerQuery();
  return QueryResult.isSuccess(viewer)
    ? Option.map(
        Arr.findFirst(viewer.value.units, (unit) => unit.status === "active"),
        (unit) => unit.timeZone
      )
    : Option.none<string>();
}

/**
 * The zone a class reads and writes its moments in: the school's clock, or the device's until the
 * school is read, which no dialog sees, since a dialog opens on a page that already read it.
 */
export function useClockZone() {
  return Option.getOrElse(useSchoolTimeZone(), () =>
    DateTime.zoneToString(DateTime.zoneMakeLocal())
  );
}

/**
 * Renders one moment as the school's clock shows it: the date and time in the time
 * zone of the school's first active unit, in the reader's language. It renders
 * nothing until the school is read, so the time never shows in another zone first.
 */
export function SchoolDateTime({ at }: { at: number }) {
  const locale = useLocale();
  const timeZone = useSchoolTimeZone();

  if (Option.isNone(timeZone)) {
    return null;
  }

  return <>{schoolDateTimeText({ at, locale, timeZone: timeZone.value })}</>;
}
