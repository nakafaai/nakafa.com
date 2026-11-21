import { Ember, Flame } from "@repo/design-system/components/ui/flame";
import { Array as Arr } from "effect";

export const card = {
  name: "Flame",
  group: "Identity",
  height: 220,
  source: "components/ui/flame",
};

/** A week of days, each lit on a day learned. */
const WEEK = [
  { day: "mon", lit: true },
  { day: "tue", lit: true },
  { day: "wed", lit: false },
  { day: "thu", lit: true },
  { day: "fri", lit: true },
  { day: "sat", lit: false },
  { day: "sun", lit: false },
];

/** The flame of a run of days from out to its later stages, and a week of embers, lit on the days learned. */
export function Preview() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-end gap-4">
        {Arr.map([0, 1, 2, 3, 4], (stage) => (
          <Flame className="w-10" key={stage} stage={stage} />
        ))}
      </div>
      <div className="flex gap-2">
        {Arr.map(WEEK, ({ day, lit }) => (
          <Ember className="w-6" key={day} lit={lit} />
        ))}
      </div>
    </div>
  );
}
