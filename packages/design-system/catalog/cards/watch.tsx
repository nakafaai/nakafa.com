import { Animal } from "@repo/design-system/components/ui/animal";
import { Watch } from "@repo/design-system/components/ui/watch";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";

type Mascot = NonNullable<ComponentProps<typeof Animal>["mascot"]>;

// Four animals of cast("Nakafa", 6): their eyes follow the pointer while the group is near the screen.
const cast: readonly Mascot[] = [
  { animal: "frog", eyes: "open", ground: "b45c6e", palette: 0, pose: "left" },
  {
    animal: "eagle",
    eyes: "open",
    ground: "f4c7cf",
    palette: 0,
    pose: "center",
  },
  {
    animal: "octopus",
    eyes: "open",
    ground: "3f6fa0",
    palette: 1,
    pose: "peek-right",
  },
  {
    animal: "penguin",
    eyes: "open",
    ground: "cfe6f7",
    palette: 0,
    pose: "peek-left",
  },
];

export const card = {
  name: "Watch",
  group: "Identity",
  height: 170,
  source: "components/ui/watch",
};

/** The card's live example. */
export function Preview() {
  return (
    <Watch className="flex flex-wrap items-end gap-4 p-6">
      {Arr.map(cast, (mascot) => (
        <div
          className="size-20 overflow-hidden rounded-full"
          key={mascot.animal}
        >
          <Animal mascot={mascot} />
        </div>
      ))}
    </Watch>
  );
}
