import { useFrame } from "@react-three/fiber";
import {
  caseAt,
  playSeconds,
} from "@repo/design-system/components/contents/mathematics/logic/table";
import type {
  Case,
  LogicMode,
} from "@repo/design-system/components/contents/mathematics/logic/truth";
import { rowOf } from "@repo/design-system/components/contents/mathematics/logic/truth";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { useRef } from "react";

/**
 * While the card plays, steps the switches through the rows of the truth
 * table in the table's own order, each held a moment, and tells the card each
 * case as it comes, so the learner watches every row fill.
 */
export function PlayCases({
  mode,
  onCase,
}: {
  readonly mode: LogicMode;
  readonly onCase: (state: Case) => void;
}) {
  const { advance, playing } = useTimeline(0, playSeconds(mode));
  const shown = useRef(-1);

  useFrame((_, delta) => {
    const time = advance(delta);
    if (!playing) {
      shown.current = -1;
      return;
    }
    const now = caseAt(mode, time);
    const row = rowOf(mode, now);
    if (row !== shown.current) {
      shown.current = row;
      onCase(now);
    }
  });

  return <SimulationTicker running={playing} />;
}
