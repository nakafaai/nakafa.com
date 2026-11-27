import { RoundedBox } from "@react-three/drei";
import type { BoardPoint } from "@repo/design-system/components/contents/mathematics/pcb";
import {
  CircuitBoard,
  Pads,
  Traces,
} from "@repo/design-system/components/contents/mathematics/pcb";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { LAMP_COLORS } from "@repo/design-system/lib/material/lamp";
import { Array as Arr } from "effect";

/** The distance between neighbouring lamps, in metres. */
export const PITCH = 0.09;

/** The walnut case: its height and depth, and the margin beyond the end lamps, in metres. */
export const CASE = { depth: 0.25, height: 0.05, margin: 0.05 } as const;

/** The brushed aluminium faceplate on top of the case, in metres. */
const FACE = { inset: 0.012, thickness: 0.0016 } as const;

/** The height the parts on the faceplate stand on. */
export const TOP = CASE.height + FACE.thickness;

/** How far back each row of parts stands on the faceplate, in metres. */
export const ROW = {
  bracket: 0.1,
  bulb: -0.07,
  plate: 0.05,
  toggle: -0.008,
} as const;

/** The x position of a panel slot, the slots centred on the middle. */
export function slotX(slot: number, slots: number) {
  return (slot - (slots - 1) / 2) * PITCH;
}

/** How far behind the lamps the ground rail runs, and how far in front of the switches the supply rail runs. */
const RAIL = { ground: ROW.bulb - 0.034, supply: ROW.toggle + 0.026 } as const;

/** How wide a signal trace and a power rail are plotted, in metres. */
const TRACE = { rail: 0.0034, signal: 0.0018 } as const;

/**
 * The walnut case and the circuit board on top of it: a green FR4 board
 * whose copper shows through the solder mask. A supply rail runs in front of
 * the switches and a ground rail behind the lamps; each column's trace leaves
 * the supply rail, passes its switch, and jogs at 45 degrees to its lamp,
 * which returns to ground. Gold pads ring every part's solder joints.
 */
export function PanelCase({
  slots,
  width,
}: {
  readonly slots: number;
  readonly width: number;
}) {
  const plateWidth = width - FACE.inset * 2;
  const plateDepth = CASE.depth - FACE.inset * 2;
  const columns = Arr.map(Arr.range(0, slots - 1), (slot) =>
    slotX(slot, slots)
  );
  const ends = [-plateWidth / 2 + 0.02, plateWidth / 2 - 0.02] as const;
  const jog = 0.007;
  const signals = Arr.flatMap(columns, (x): BoardPoint[][] => [
    [
      [x - jog, RAIL.supply],
      [x - jog, ROW.toggle + 0.012],
      [x, ROW.toggle + 0.005],
      [x, ROW.toggle - 0.016],
      [x + jog, ROW.toggle - 0.023],
      [x + jog, ROW.bulb + 0.02],
      [x, ROW.bulb + 0.013],
    ],
    [
      [x, ROW.bulb - 0.013],
      [x, RAIL.ground],
    ],
  ]);
  const joints = Arr.flatMap(columns, (x): BoardPoint[] => [
    [x - jog, RAIL.supply],
    [x, RAIL.ground],
    [x - 0.008, ROW.toggle],
    [x + 0.008, ROW.toggle],
    [x - 0.009, ROW.bulb + 0.013],
    [x + 0.009, ROW.bulb + 0.013],
  ]);
  return (
    <group>
      <RoundedBox
        args={[width, CASE.height, CASE.depth]}
        castShadow
        position={[0, CASE.height / 2, 0]}
        radius={0.006}
        receiveShadow
        smoothness={6}
      >
        <SurfaceMaterial
          bump={0.012}
          coat={0.5}
          color={LAMP_COLORS.walnut}
          repeat={[0.4, 3]}
          roughness={0.5}
          surface="wood"
        />
      </RoundedBox>
      <mesh position={[0, CASE.height * 0.12, 0]}>
        <boxGeometry args={[width + 0.002, 0.004, CASE.depth + 0.002]} />
        <meshStandardMaterial color={LAMP_COLORS.walnutEdge} roughness={0.8} />
      </mesh>
      <CircuitBoard
        depth={plateDepth}
        thickness={FACE.thickness}
        top={TOP}
        width={plateWidth}
      >
        <Traces
          runs={[
            [
              [ends[0], RAIL.supply],
              [ends[1], RAIL.supply],
            ],
            [
              [ends[0], RAIL.ground],
              [ends[1], RAIL.ground],
            ],
          ]}
          width={TRACE.rail}
        />
        <Traces runs={signals} width={TRACE.signal} />
        <Pads hole={0.0006} radius={0.0019} spots={joints} />
      </CircuitBoard>
    </group>
  );
}
