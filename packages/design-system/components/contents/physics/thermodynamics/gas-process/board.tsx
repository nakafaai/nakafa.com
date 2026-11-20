import { Line } from "@react-three/drei";
import type {
  Axes,
  Axis,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/diagram";
import { axisTicks } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/diagram";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { GAS_COLORS } from "@repo/design-system/lib/material/gas";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Vector3 } from "three";

/**
 * The board the p-V diagram is drawn on, in metres: the plot, and the
 * margins round it that hold the axes' marks and names. The board's group
 * stands at the plot's origin, so every mark of the diagram is drawn from
 * there.
 */
export const BOARD = {
  depth: 0.012,
  margin: { bottom: 0.078, left: 0.074, right: 0.12, top: 0.056 },
  plot: { height: 0.24, width: 0.27 },
} as const;

/** The width and height of the whole board. */
const BOARD_SIZE = {
  height: BOARD.margin.bottom + BOARD.plot.height + BOARD.margin.top,
  width: BOARD.margin.left + BOARD.plot.width + BOARD.margin.right,
} as const;

/** How far in front of the paper the marks drawn on it stand, so none flickers into it. */
export const INK = 0.0012;

/** How tall the writing on the board stands, in metres. */
export const LABEL_SIZE = 0.015;

/** What every label on the paper shares: dark ink with a halo the colour of the paper, never smaller than 13 pixels. */
export const PAPER_LABEL = {
  color: INSTRUMENT_COLORS.graphite,
  minimumFontSize: 13,
  outlineColor: INSTRUMENT_COLORS.paper,
  outlineWidth: 0.0024,
} as const;

/** The places of a grid's lines across one axis: every half step to its end. */
function gridLines(axis: Axis) {
  return Arr.makeBy(Math.round((axis.maximum / axis.step) * 2) + 1, (index) =>
    Number(((index * axis.step) / 2).toPrecision(12))
  );
}

/**
 * A sheet of graph paper on an aluminium board standing on two legs on the
 * bench, `rise` metres below the plot's origin: the faint grid at every half
 * step, the two axes from zero, the marks of each axis written on them, the
 * pressure axis's name over its top and the volume axis's name under its
 * marks.
 */
export function PaperBoard({
  axes,
  names,
  rise,
  tick,
}: {
  readonly axes: Axes;
  readonly names: { readonly pressure: ReactNode; readonly volume: ReactNode };
  readonly rise: number;
  readonly tick: (value: number) => string;
}) {
  const { height, width } = BOARD.plot;
  const across = (volume: number) => (volume / axes.volume.maximum) * width;
  const up = (pressure: number) => (pressure / axes.pressure.maximum) * height;
  const grid = Arr.appendAll(
    Arr.flatMap(gridLines(axes.volume), (volume) => [
      new Vector3(across(volume), 0, INK / 2),
      new Vector3(across(volume), height, INK / 2),
    ]),
    Arr.flatMap(gridLines(axes.pressure), (pressure) => [
      new Vector3(0, up(pressure), INK / 2),
      new Vector3(width, up(pressure), INK / 2),
    ])
  );
  const centre = {
    x: BOARD_SIZE.width / 2 - BOARD.margin.left,
    y: BOARD_SIZE.height / 2 - BOARD.margin.bottom,
  };
  const legHeight = rise - BOARD.margin.bottom;

  return (
    <group>
      <mesh
        castShadow
        position={[centre.x, centre.y, -BOARD.depth / 2 - 0.001]}
      >
        <boxGeometry
          args={[
            BOARD_SIZE.width + 0.014,
            BOARD_SIZE.height + 0.014,
            BOARD.depth,
          ]}
        />
        <MetalMaterial color={INSTRUMENT_COLORS.aluminium} roughness={0.45} />
      </mesh>
      <mesh position={[centre.x, centre.y, 0]} receiveShadow>
        <planeGeometry args={[BOARD_SIZE.width, BOARD_SIZE.height]} />
        <meshStandardMaterial
          color={INSTRUMENT_COLORS.paper}
          emissive={INSTRUMENT_COLORS.paper}
          emissiveIntensity={0.3}
          envMapIntensity={0.5}
          roughness={0.92}
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={side}
          position={[
            centre.x + side * (BOARD_SIZE.width / 2 - 0.03),
            -BOARD.margin.bottom - legHeight / 2,
            -BOARD.depth / 2,
          ]}
        >
          <boxGeometry args={[0.014, legHeight, 0.014]} />
          <MetalMaterial color={INSTRUMENT_COLORS.aluminium} roughness={0.4} />
        </mesh>
      ))}
      <Line color={GAS_COLORS.grid} lineWidth={1} points={grid} segments />
      <Line
        color={INSTRUMENT_COLORS.graphite}
        lineWidth={2}
        points={[
          [0, height + 0.012, INK],
          [0, 0, INK],
          [width + 0.012, 0, INK],
        ]}
      />
      <ThreeLabel
        {...PAPER_LABEL}
        anchorX="right"
        anchorY="top"
        fontSize={LABEL_SIZE}
        gap={0.006}
        position={[0, 0, INK]}
      >
        0
      </ThreeLabel>
      {Arr.map(axisTicks(axes.volume), (volume) => (
        <ThreeLabel
          {...PAPER_LABEL}
          anchorY="top"
          fontSize={LABEL_SIZE}
          gap={0.008}
          key={volume}
          position={[across(volume), 0, INK]}
        >
          {tick(volume)}
        </ThreeLabel>
      ))}
      {Arr.map(axisTicks(axes.pressure), (pressure) => (
        <ThreeLabel
          {...PAPER_LABEL}
          anchorX="right"
          fontSize={LABEL_SIZE}
          gap={0.008}
          key={pressure}
          position={[0, up(pressure), INK]}
        >
          {tick(pressure)}
        </ThreeLabel>
      ))}
      <ThreeLabel
        {...PAPER_LABEL}
        anchorY="top"
        fontSize={LABEL_SIZE}
        position={[width / 2, -0.04, INK]}
      >
        {names.volume}
      </ThreeLabel>
      <ThreeLabel
        {...PAPER_LABEL}
        anchorY="bottom"
        fontSize={LABEL_SIZE}
        gap={0.012}
        position={[0, height + 0.012, INK]}
      >
        {names.pressure}
      </ThreeLabel>
    </group>
  );
}
