import { Thing } from "@repo/design-system/components/ui/thing";
import { Array as Arr } from "effect";

// Nina's 32 things, in the order of the thing catalog.
const names = [
  "book",
  "pencil",
  "padlock",
  "key",
  "magnifier",
  "bubble",
  "check",
  "coffee",
  "medal",
  "note",
  "balls",
  "eraser",
  "ruler",
  "backpack",
  "stopwatch",
  "calendar",
  "trophy",
  "bulb",
  "calculator",
  "letter",
  "plane",
  "highlighter",
  "glasses",
  "cap",
  "shield",
  "headphones",
  "donut",
  "hourglass",
  "globe",
  "clip",
  "flag",
  "board",
] as const;

export const card = {
  name: "Thing",
  group: "Identity",
  height: 260,
  source: "thing",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex flex-wrap gap-4 p-6">
      {Arr.map(names, (name) => (
        <Thing key={name} name={name} size={40} />
      ))}
    </div>
  );
}
