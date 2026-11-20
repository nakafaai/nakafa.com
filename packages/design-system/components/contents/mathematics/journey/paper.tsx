import { Line } from "@react-three/drei";
import type { Axes } from "@repo/design-system/components/contents/mathematics/journey/axis";
import type { Sheet } from "@repo/design-system/components/contents/mathematics/journey/layout";
import {
  graphSpot,
  INK,
  PAPER,
  pointAt,
} from "@repo/design-system/components/contents/mathematics/journey/layout";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { JOURNEY_COLORS } from "@repo/design-system/lib/material/journey";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";

/** The size of the words and numbers printed on the paper, in metres, and their limits on screen, in pixels. */
const PRINT = { largest: 15, size: 0.034, smallest: 11 } as const;

/** How far a number stands off its axis, in metres. */
const OFF = 0.012;

/** How long each stroke of an axis's arrowhead is, in metres. */
const HEAD = 0.012;

/**
 * Words printed on the paper: dark ink edged in the paper's own colour, so a
 * line passing under a number stops at its letters in either theme.
 */
export function Print({
  anchorX = "center",
  anchorY = "middle",
  children,
  color = JOURNEY_COLORS.ink,
  x,
  z,
}: {
  readonly anchorX?: "center" | "left" | "right";
  readonly anchorY?: "bottom" | "middle" | "top";
  readonly children: ReactNode;
  readonly color?: string;
  readonly x: number;
  readonly z: number;
}) {
  return (
    <ThreeLabel
      anchorX={anchorX}
      anchorY={anchorY}
      color={color}
      fontSize={PRINT.size}
      maximumFontSize={PRINT.largest}
      minimumFontSize={PRINT.smallest}
      outlineColor={JOURNEY_COLORS.paper}
      outlineWidth={PRINT.size * 0.22}
      position={[x, INK.dot, z]}
    >
      {children}
    </ThreeLabel>
  );
}

/** The lines of a grid with `every` lines to each numbered step across and back, from 0 to the axes' tops. */
function gridLines(
  sheet: Sheet,
  axes: Axes,
  every: { readonly across: number; readonly back: number }
) {
  const tops = { km: axes.km.top, minute: axes.minute.top };
  const across = Arr.makeBy(
    Math.round((axes.minute.top / axes.minute.step) * every.across) + 1,
    (index) => {
      const minute = (index * axes.minute.step) / every.across;
      return [
        pointAt(graphSpot(sheet, tops, minute, 0), INK.grid),
        pointAt(graphSpot(sheet, tops, minute, axes.km.top), INK.grid),
      ];
    }
  );
  const back = Arr.makeBy(
    Math.round((axes.km.top / axes.km.step) * every.back) + 1,
    (index) => {
      const km = (index * axes.km.step) / every.back;
      return [
        pointAt(graphSpot(sheet, tops, 0, km), INK.grid),
        pointAt(graphSpot(sheet, tops, axes.minute.top, km), INK.grid),
      ];
    }
  );
  return Arr.flatten([...across, ...back]);
}

/** One line to each numbered step, for the grid's stronger lines. */
const NUMBERED = { across: 1, back: 1 } as const;

/**
 * A sheet of squared graph paper on the table, its grid printed in pale blue
 * with a stronger line at every numbered step, and its two axes in ink with
 * arrowheads: time across, numbered under the axis, and distance back from
 * the front, numbered to its left, level with the road's kilometre posts.
 * The origin is O, and each axis carries its name at its far end.
 */
export function GraphPaper({
  axes,
  sheet,
  titles,
}: {
  readonly axes: Axes;
  readonly sheet: Sheet;
  readonly titles: { readonly distance: string; readonly time: string };
}) {
  const quantity = useQuantity();
  const tops = { km: axes.km.top, minute: axes.minute.top };
  const origin = graphSpot(sheet, tops, 0, 0);
  const end = graphSpot(sheet, tops, axes.minute.top, axes.km.top);
  const width = sheet.width + PAPER.left + PAPER.right;
  const depth = sheet.depth + PAPER.front + PAPER.back;
  const tipX = end.x + 0.03;
  const tipZ = end.z - 0.03;

  return (
    <group>
      <mesh
        position={[
          origin.x - PAPER.left + width / 2,
          INK.paper / 2,
          origin.z + PAPER.front - depth / 2,
        ]}
        receiveShadow
      >
        <boxGeometry args={[width, INK.paper, depth]} />
        <meshStandardMaterial color={JOURNEY_COLORS.paper} roughness={0.92} />
      </mesh>
      <Line
        color={JOURNEY_COLORS.grid}
        lineWidth={0.6}
        opacity={0.55}
        points={gridLines(sheet, axes, sheet.squares)}
        segments
        transparent
      />
      <Line
        color={JOURNEY_COLORS.grid}
        lineWidth={1.1}
        points={gridLines(sheet, axes, NUMBERED)}
        segments
      />
      <Line
        color={JOURNEY_COLORS.ink}
        lineWidth={1.6}
        points={[
          [origin.x, INK.axis, tipZ],
          [origin.x, INK.axis, origin.z],
          [tipX, INK.axis, origin.z],
        ]}
      />
      <Line
        color={JOURNEY_COLORS.ink}
        lineWidth={1.6}
        points={[
          [origin.x - HEAD / 2, INK.axis, tipZ + HEAD],
          [origin.x, INK.axis, tipZ],
          [origin.x + HEAD / 2, INK.axis, tipZ + HEAD],
          [origin.x, INK.axis, tipZ],
          [tipX - HEAD, INK.axis, origin.z - HEAD / 2],
          [tipX, INK.axis, origin.z],
          [tipX - HEAD, INK.axis, origin.z + HEAD / 2],
          [tipX, INK.axis, origin.z],
        ]}
        segments
      />
      <Print
        anchorX="right"
        anchorY="top"
        x={origin.x - OFF / 2}
        z={origin.z + OFF / 2}
      >
        <InlineMath math="O" />
      </Print>
      {Arr.map(Arr.drop(axes.minute.ticks, 1), (minute) => (
        <Print
          anchorY="top"
          key={minute}
          x={graphSpot(sheet, tops, minute, 0).x}
          z={origin.z + OFF}
        >
          <InlineMath math={quantity(minute, "", 1)} />
        </Print>
      ))}
      {Arr.map(Arr.drop(axes.km.ticks, 1), (km) => (
        <Print
          anchorX="right"
          key={km}
          x={origin.x - OFF}
          z={graphSpot(sheet, tops, 0, km).z}
        >
          <InlineMath math={quantity(km, "", 1)} />
        </Print>
      ))}
      <Print
        anchorX="left"
        anchorY="bottom"
        x={origin.x - PAPER.left / 2}
        z={tipZ - OFF}
      >
        {titles.distance}
      </Print>
      <Print anchorX="right" anchorY="top" x={tipX} z={origin.z + OFF + 0.042}>
        {titles.time}
      </Print>
    </group>
  );
}
