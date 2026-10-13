import { Nina } from "@repo/design-system/components/ui/nina";
import { Thing } from "@repo/design-system/components/ui/thing";
import type { ComponentProps } from "react";
import { FIGURE_GAP, NINA_SIZE, THING_SIZE } from "@/components/state/size";

/**
 * What she does in each kind of state, and the two things that lie beside her.
 * Searching, the magnifier is already in her hand, so it does not lie beside
 * her too. No thing appears in two of them.
 */
const SCENES = {
  broken: { act: "typing", things: ["coffee", "bulb"] },
  missing: { act: "searching", things: ["letter", "plane"] },
  school: { act: "searching", things: ["backpack", "board"] },
} as const;

/**
 * One of the two things that lie beside her, on the floor she stands on. It is
 * left out while the figure has less room than the three of them side by side,
 * which is `FIGURE_WIDTH` and is written here as `18.5rem`.
 */
function Beside({ name }: Pick<ComponentProps<typeof Thing>, "name">) {
  return (
    <Thing
      className="mb-4 @min-[18.5rem]:block hidden"
      name={name}
      size={THING_SIZE}
    />
  );
}

/**
 * Nina doing the one thing that fits a state, with a thing on each side of
 * her. The row is the container that decides whether the things have room.
 */
export function Figure({ scene }: { scene: keyof typeof SCENES }) {
  const { act, things } = SCENES[scene];
  const [before, after] = things;

  return (
    <div
      className="@container flex size-full items-end justify-center"
      style={{ gap: FIGURE_GAP }}
    >
      <Beside name={before} />
      <Nina act={act} label="" size={NINA_SIZE} whole />
      <Beside name={after} />
    </div>
  );
}
