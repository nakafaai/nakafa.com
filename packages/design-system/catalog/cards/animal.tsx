import { Animal } from "@repo/design-system/components/ui/animal";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";

type Mascot = NonNullable<ComponentProps<typeof Animal>["mascot"]>;

// The animals, palettes, grounds and poses of cast("Nakafa", 6); the eyes vary to show each kind of eye.
const cast: readonly Mascot[] = [
  { animal: "frog", eyes: "open", ground: "b45c6e", palette: 0, pose: "left" },
  {
    animal: "eagle",
    eyes: "smile",
    ground: "f4c7cf",
    palette: 0,
    pose: "center",
  },
  {
    animal: "octopus",
    eyes: "wink",
    ground: "3f6fa0",
    palette: 1,
    pose: "peek-right",
  },
  {
    animal: "penguin",
    eyes: "asleep",
    ground: "cfe6f7",
    palette: 0,
    pose: "peek-left",
  },
  {
    animal: "parrot",
    eyes: "open",
    ground: "2e5b45",
    palette: 1,
    pose: "peek",
  },
  {
    animal: "crab",
    eyes: "smile",
    ground: "2e5b45",
    palette: 0,
    pose: "right",
  },
];

export const card = {
  name: "Animal",
  group: "Identity",
  height: 170,
  source: "animal",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex flex-wrap items-end gap-4 p-6">
      {Arr.map(cast, (mascot) => (
        <div
          className="size-20 overflow-hidden rounded-full"
          key={mascot.animal}
        >
          <Animal mascot={mascot} />
        </div>
      ))}
    </div>
  );
}
