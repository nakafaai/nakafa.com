import { useFrame } from "@react-three/fiber";
import type { Seat } from "@repo/design-system/components/contents/mathematics/argument/chain";
import {
  arrangementAt,
  HOLD,
} from "@repo/design-system/components/contents/mathematics/argument/chain";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { Array as Arr } from "effect";
import { useRef } from "react";

/**
 * While the card plays, deals the hand into the chain every way it can go,
 * starting from an empty chain, each way held a moment, and tells the card
 * each one as it comes, so the learner watches the links lock or break for
 * every choice in turn.
 */
export function PlayArrangements({
  list,
  onArrange,
}: {
  readonly list: readonly (readonly Seat[])[];
  readonly onArrange: (seats: readonly Seat[]) => void;
}) {
  const { advance, playing } = useTimeline(0, list.length * HOLD);
  const shown = useRef(-1);

  useFrame((_, delta) => {
    const time = advance(delta);
    if (!playing) {
      shown.current = -1;
      return;
    }
    const index = arrangementAt(list.length, time);
    if (index !== shown.current) {
      shown.current = index;
      onArrange(Arr.getUnsafe(list, index));
    }
  });

  return <SimulationTicker running={playing} />;
}
