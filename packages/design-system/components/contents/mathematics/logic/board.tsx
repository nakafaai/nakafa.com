import {
  BOARD,
  BOARD_TOP,
  HOLE,
} from "@repo/design-system/components/contents/mathematics/logic/rig";
import type { BoardPoint } from "@repo/design-system/components/contents/mathematics/pcb";
import {
  CircuitBoard,
  Pads,
  Traces,
} from "@repo/design-system/components/contents/mathematics/pcb";
import { StudioTable } from "@repo/design-system/components/contents/mathematics/table";
import { LOGIC_COLORS } from "@repo/design-system/lib/material/logic";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/** The holes of the pegboard, a pitch apart, kept a pitch clear of every edge. */
function holeSpots() {
  const columns = Math.floor(BOARD.width / HOLE.pitch) - 1;
  const rows = Math.floor(BOARD.depth / HOLE.pitch) - 1;
  return Arr.flatMap(Arr.range(0, rows - 1), (row) =>
    Arr.map(Arr.range(0, columns - 1), (column) => ({
      x: (column - (columns - 1) / 2) * HOLE.pitch,
      z: (row - (rows - 1) / 2) * HOLE.pitch,
    }))
  );
}

/** The oak desk the board lies on, planked and oiled, running out past the frame. */
export function Desk() {
  return <StudioTable color={LOGIC_COLORS.desk} />;
}

/** How far the gold land round each plated hole reaches, in metres. */
const LAND = HOLE.radius * 1.75;

/**
 * A trainer board: green FR4 with a plated through-hole an inch apart for
 * every part's fixing, each ringed by a gold land, and the supply and return
 * rails plotted in copper along its front and back edges, as a school
 * electronics kit is built on.
 */
export function Pegboard() {
  const spots = useMemo(
    () => Arr.map(holeSpots(), ({ x, z }): BoardPoint => [x, z]),
    []
  );
  const rail = BOARD.depth / 2 - HOLE.pitch * 0.45;
  const reach = BOARD.width / 2 - HOLE.pitch * 0.9;
  return (
    <CircuitBoard
      depth={BOARD.depth}
      inset={HOLE.pitch * 0.4}
      thickness={BOARD.thickness}
      top={BOARD_TOP}
      width={BOARD.width}
    >
      <Traces
        runs={[
          [
            [-reach, rail],
            [reach, rail],
          ],
          [
            [-reach, -rail],
            [reach, -rail],
          ],
        ]}
        width={0.004}
      />
      <Pads hole={HOLE.radius} radius={LAND} spots={spots} />
    </CircuitBoard>
  );
}
