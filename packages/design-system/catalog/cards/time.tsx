import { TimeSelect } from "@repo/design-system/components/ui/time";
import { useState } from "react";

/** A start time every quarter hour, and an end time every half hour. */
export function Preview() {
  const [time, setTime] = useState("08:15");

  return (
    <div className="flex gap-4 p-6">
      <TimeSelect
        aria-label="Start time"
        className="w-36"
        onValueChange={setTime}
        placeholder="08:00"
        value={time}
      />
      <TimeSelect
        aria-label="End time"
        className="w-36"
        onValueChange={() => undefined}
        placeholder="09:30"
        step={30}
        value=""
      />
    </div>
  );
}

export const card = {
  name: "TimeSelect",
  group: "Forms",
  height: 120,
  source: "time",
};
