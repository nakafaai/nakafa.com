import {
  DatePicker,
  DateTimePicker,
} from "@repo/design-system/components/ui/date";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { useState } from "react";

/** A period's first day and a sitting's start, as the School forms hold them. */
function Dates() {
  const [first, setFirst] = useState("2026-07-13");
  const [starts, setStarts] = useState("2026-10-27T08:15");

  return (
    <div className="flex max-w-sm flex-col gap-6 p-6">
      <Field>
        <FieldLabel htmlFor="first-day">First day</FieldLabel>
        <DatePicker
          id="first-day"
          onValueChange={setFirst}
          placeholder="Pick the first day"
          value={first}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="last-day">Last day</FieldLabel>
        <DatePicker
          id="last-day"
          min={first}
          onValueChange={() => undefined}
          placeholder="Pick the last day"
          value=""
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="starts">Starts</FieldLabel>
        <DateTimePicker
          dayPlaceholder="Pick a day"
          id="starts"
          onValueChange={setStarts}
          timePlaceholder="08:00"
          value={starts}
        />
      </Field>
    </div>
  );
}

export const card = {
  name: "DatePicker",
  group: "Forms",
  height: 420,
  source: "date",
};

/** The card's live example. */
export function Preview() {
  return <Dates />;
}
