import { Calendar } from "@repo/design-system/components/ui/calendar";
import { DateTime } from "effect";

// Noon UTC keeps the same calendar day in every time zone from UTC-11 to UTC+11.
const day = (date: string) =>
  DateTime.toDateUtc(DateTime.makeUnsafe(`${date}T12:00:00.000Z`));

export const card = {
  name: "Calendar",
  group: "Forms",
  height: 384,
  source: "components/ui/calendar",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="p-6">
      <Calendar
        className="w-fit rounded-lg border"
        defaultMonth={day("2026-09-01")}
        mode="single"
        selected={day("2026-09-30")}
      />
    </div>
  );
}
