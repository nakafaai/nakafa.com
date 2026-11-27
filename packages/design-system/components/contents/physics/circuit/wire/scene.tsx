import { OakBoard } from "@repo/design-system/components/contents/physics/bench/board";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { DryCell } from "@repo/design-system/components/contents/physics/bench/cell";
import { Lead } from "@repo/design-system/components/contents/physics/bench/lead";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import { wireRatios } from "@repo/design-system/components/contents/physics/circuit/current";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { Shine } from "@repo/design-system/components/three/matter/shine";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/** The first wire's length and radius, in scene units, which the second wire multiplies. */
const UNIT_LENGTH = 0.72;
const UNIT_RADIUS = 0.011;
/** Where every wire starts, how high it is strung, where the two wires run, and where the cell lies. */
const LEFT = -0.85;
const HEIGHT = 0.24;
const BACK = -0.26;
const FRONT = 0.32;
const CELL_X = LEFT - 0.44;
const CELL_Z = 0.02;
/** How fast the charge markers of the first wire's current drift, in scene units a second. */
const DRIFT = 0.5;

const SHEDS = [0.07, 0.13] as const;

type Point = readonly [number, number, number];

const FEED: readonly Point[] = [
  [CELL_X, 0.09, CELL_Z + 0.42],
  [CELL_X + 0.2, 0.035, FRONT + 0.2],
  [LEFT - 0.08, 0.06, FRONT + 0.1],
  [LEFT, HEIGHT - 0.01, FRONT],
];
const LINK: readonly Point[] = [
  [LEFT, HEIGHT - 0.01, FRONT],
  [LEFT - 0.1, 0.05, (FRONT + BACK) / 2],
  [LEFT, HEIGHT - 0.01, BACK],
];

/** A ribbed porcelain standoff with a brass clamp, which holds one end of a wire above the board. */
function Standoff({ position }: { readonly position: Point }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, HEIGHT / 2 - 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.032, 0.04, HEIGHT - 0.04, 24]} />
        <Matter of="porcelain" />
      </mesh>
      {Arr.map(SHEDS, (y) => (
        <mesh castShadow key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.046, 0.058, 0.024, 24]} />
          <Matter of="porcelain" />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.06, 0.064, 0.024, 24]} />
        <Matter of="nickel" />
      </mesh>
      <mesh castShadow position={[0, HEIGHT, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.07, 6]} />
        <Matter of="brass" />
      </mesh>
    </group>
  );
}

/** One nichrome wire strung along x from the left standoffs, `length` long and `radius` thick, glowing with `glow`. */
function Wire({
  glow,
  length,
  radius,
  row,
}: {
  readonly glow: number;
  readonly length: number;
  readonly radius: number;
  readonly row: number;
}) {
  return (
    <group>
      <Standoff position={[LEFT, 0, row]} />
      <Standoff position={[LEFT + length, 0, row]} />
      <mesh
        castShadow
        position={[LEFT + length / 2, HEIGHT, row]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[radius, radius, length, 20]} />
        <Matter glow={glow} of="nichrome" />
        <Shine glow={glow} of="nichrome" />
      </mesh>
    </group>
  );
}

/** The lead that takes one wire's current home: from its right end round the back of the board to the cell's negative post. */
function home(length: number, row: number, lane: number): readonly Point[] {
  return [
    [LEFT + length, HEIGHT - 0.01, row],
    [LEFT + length + 0.14, 0.035, row - 0.08],
    [LEFT + length + 0.1, 0.035, BACK - 0.3 - lane],
    [LEFT, 0.035, BACK - 0.34 - lane],
    [CELL_X + 0.16, 0.035, CELL_Z - 0.6 - lane / 2],
    [CELL_X, 0.09, CELL_Z - 0.42],
  ];
}

/**
 * Two nichrome wires on one oak board, strung between porcelain standoffs
 * and joined in parallel to the same cell, drawn to scale: the second wire is
 * `length` times as long and `diameter` times as thick as the first. The wire
 * that takes more power glows hotter.
 */
export function WireResistanceScene({
  diameter,
  length,
}: {
  readonly diameter: number;
  readonly length: number;
}) {
  const second = wireRatios(length, diameter);
  const most = Math.max(1, second.power);
  const first = useMemo(() => home(UNIT_LENGTH, BACK, 0), []);
  const other = useMemo(() => home(UNIT_LENGTH * length, FRONT, 0.1), [length]);

  return (
    <group>
      <BenchCamera
        narrow={[0, 3.1, 5]}
        target={[0, 0.12, 0]}
        wide={[0, 2.4, 3.95]}
      />
      <OakBoard depth={1.9} width={3.3}>
        <group position={[CELL_X, 0, CELL_Z]} rotation={[0, -Math.PI / 2, 0]}>
          <DryCell />
        </group>
        <Wire
          glow={Math.sqrt(1 / most) * 0.92}
          length={UNIT_LENGTH}
          radius={UNIT_RADIUS}
          row={BACK}
        />
        <Wire
          glow={Math.sqrt(second.power / most) * 0.92}
          length={UNIT_LENGTH * length}
          radius={UNIT_RADIUS * diameter}
          row={FRONT}
        />
        <Lead
          color={APPARATUS_COLORS.leadRed}
          flow={DRIFT * (1 + second.power)}
          points={FEED}
          radius={0.016}
        />
        <Lead
          color={APPARATUS_COLORS.leadRed}
          flow={DRIFT}
          points={LINK}
          radius={0.016}
        />
        <Lead
          color={APPARATUS_COLORS.leadBlack}
          flow={DRIFT}
          points={first}
          radius={0.016}
        />
        <Lead
          color={APPARATUS_COLORS.leadBlack}
          flow={DRIFT * second.power}
          points={other}
          radius={0.016}
        />
        <Tag position={[LEFT + UNIT_LENGTH / 2, HEIGHT + 0.17, BACK]}>
          <InlineMath math="R_1" />
        </Tag>
        <Tag
          position={[
            LEFT + (UNIT_LENGTH * length) / 2,
            HEIGHT - 0.1,
            FRONT + 0.3,
          ]}
        >
          <InlineMath math="R_2" />
        </Tag>
      </OakBoard>
    </group>
  );
}
