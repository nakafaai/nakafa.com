import { QueryResult } from "@confect/react";
import { Array as Arr, Option } from "effect";
import { useLocale } from "use-intl";
import { useViewerQuery } from "@/components/tenant/context";
import { schoolDateTimeText } from "@/components/tenant/settings/clock";

/**
 * Renders one moment as the school's clock shows it: the date and time in the time
 * zone of the school's first active unit, in the reader's language. It renders
 * nothing until the school is read, so the time never shows in another zone first.
 */
export function SchoolDateTime({ at }: { at: number }) {
  const locale = useLocale();
  const viewer = useViewerQuery();
  const timeZone = QueryResult.isSuccess(viewer)
    ? Option.getOrUndefined(
        Arr.findFirst(viewer.value.units, (unit) => unit.status === "active")
      )?.timeZone
    : undefined;

  if (timeZone === undefined) {
    return null;
  }

  return <>{schoolDateTimeText({ at, locale, timeZone })}</>;
}
