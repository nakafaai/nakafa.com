import { Calendar } from "@repo/design-system/components/ui/calendar";

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
        defaultMonth="2026-09"
        defaultValue="2026-09-30"
      />
    </div>
  );
}
