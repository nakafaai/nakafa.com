import { RoundedBox } from "@react-three/drei";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import {
  SUPPLY_SOCKETS,
  Supply,
} from "@repo/design-system/components/contents/physics/bench/cell";
import { Lead } from "@repo/design-system/components/contents/physics/bench/lead";
import { Vector } from "@repo/design-system/components/contents/physics/bench/vector";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/** Where the wire hangs when the magnetic force just balances its weight, half its length, and the gap between the poles. */
const REST = 0.34;
const HALF = 1;
const GAP = 0.5;
const SUPPLY_AT = [-1.75, 0, -0.55] as const;
const SIDES = [-1, 1] as const;
const FIELD_LINES = [-0.3, 0, 0.3] as const;

type Point = readonly [number, number, number];

/** One pole piece of the magnet, in the paint of its pole, standing on the steel yoke at `z`. */
function Pole({ color, z }: { readonly color: string; readonly z: number }) {
  return (
    <RoundedBox
      args={[0.8, 0.42, 0.22]}
      castShadow
      position={[0, 0.31, z]}
      radius={0.025}
      receiveShadow
      smoothness={4}
    >
      <Matter color={color} of="enamel" />
    </RoundedBox>
  );
}

/** A retort stand at `x` with an insulated hook over the bench, from which one end of the wire hangs. */
function Stand({ x }: { readonly x: number }) {
  return (
    <group position={[x, 0, -0.42]}>
      <mesh castShadow position={[0, 0.02, 0.1]} receiveShadow>
        <boxGeometry args={[0.34, 0.04, 0.5]} />
        <Matter of="steel" />
      </mesh>
      <mesh castShadow position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 1.28, 14]} />
        <Matter of="nickel" />
      </mesh>
      <mesh
        castShadow
        position={[0, 1.24, 0.21]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.014, 0.014, 0.46, 12]} />
        <Matter of="nickel" />
      </mesh>
      <mesh castShadow position={[0, 1.24, 0.42]}>
        <cylinderGeometry args={[0.03, 0.03, 0.06, 16]} />
        <Matter of="bakelite" />
      </mesh>
    </group>
  );
}

/**
 * The current balance on the bench: a magnet whose red north pole faces its
 * blue south pole across a gap, so the field between them points north, away
 * from the reader, and a straight copper wire hung east to west through the
 * gap from two stands. A supply drives the current through it. The magnetic
 * force on the wire is drawn against its weight, and the wire rides higher or
 * lower as the force passes or falls short of the weight.
 */
export function CurrentBalanceScene({
  current,
  share,
}: {
  readonly current: number;
  /** The magnetic force as a share of the wire's weight. */
  readonly share: number;
}) {
  const quantity = useQuantity();
  const height = REST + Math.max(-0.14, Math.min(0.14, (share - 1) * 0.25));
  const hangers = useMemo(
    () =>
      Arr.map(SIDES, (side) => ({
        key: side,
        points: [
          [side * (HALF + 0.3), 1.21, 0],
          [side * (HALF + 0.22), (1.21 + height) / 2, 0],
          [side * HALF, height, 0],
        ] satisfies readonly Point[],
      })),
    [height]
  );
  const feeds = useMemo(
    () => ({
      home: [
        [HALF + 0.3, 1.27, 0],
        [HALF + 0.42, 0.7, -0.5],
        [HALF + 0.3, 0.03, -0.85],
        [-0.6, 0.03, -0.95],
        [SUPPLY_AT[0] + 0.5, 0.03, -0.1],
        [
          SUPPLY_AT[0] + SUPPLY_SOCKETS[1][0],
          SUPPLY_SOCKETS[1][1],
          SUPPLY_AT[2] + 0.3,
        ],
      ] satisfies readonly Point[],
      out: [
        [
          SUPPLY_AT[0] + SUPPLY_SOCKETS[0][0],
          SUPPLY_SOCKETS[0][1],
          SUPPLY_AT[2] + 0.3,
        ],
        [SUPPLY_AT[0] + 0.36, 0.03, 0.1],
        [-HALF - 0.5, 0.5, -0.1],
        [-HALF - 0.3, 1.27, 0],
      ] satisfies readonly Point[],
    }),
    []
  );

  return (
    <group>
      <BenchCamera
        narrow={[0.6, 3.6, 5.6]}
        target={[-0.25, 0.5, -0.1]}
        wide={[0.5, 2.5, 3.7]}
      />
      <mesh castShadow position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[0.84, 0.1, GAP + 0.6]} />
        <Matter of="steel" />
      </mesh>
      <Pole color={APPARATUS_COLORS.poleNorth} z={GAP / 2 + 0.11} />
      <Pole color={APPARATUS_COLORS.poleSouth} z={-GAP / 2 - 0.11} />
      {Arr.map(FIELD_LINES, (x) => (
        <mesh key={x} position={[x, 0.36, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.006, GAP, 8]} />
          <Matter color={APPARATUS_COLORS.fluxGlow} glow={0.7} of="light" />
        </mesh>
      ))}
      <Vector
        color={APPARATUS_COLORS.fluxGlow}
        from={[0, 0.6, GAP / 2 + 0.1]}
        to={[0, 0.6, -GAP / 2 - 0.3]}
      >
        <InlineMath math="B" />
      </Vector>
      {Arr.map(SIDES, (side) => (
        <Stand key={side} x={side * (HALF + 0.3)} />
      ))}
      <mesh castShadow position={[0, height, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, HALF * 2, 20]} />
        <Matter of="copper" />
      </mesh>
      {Arr.map(hangers, (hanger) => (
        <Lead
          color={APPARATUS_COLORS.enamelCopper}
          flow={current * 0.3}
          key={hanger.key}
          points={hanger.points}
          radius={0.008}
        />
      ))}
      <Vector
        color={APPARATUS_COLORS.eddyGlow}
        from={[-HALF + 0.08, height + 0.08, 0]}
        to={[-HALF + 0.5, height + 0.08, 0]}
      >
        <InlineMath math="I" />
      </Vector>
      <Vector
        color={APPARATUS_COLORS.forceArrow}
        from={[0.66, height + 0.03, 0]}
        to={[0.66, height + 0.03 + 0.42 * share, 0]}
      >
        <InlineMath math="F" />
      </Vector>
      <Vector
        color={APPARATUS_COLORS.weightArrow}
        from={[0.8, height + 0.45, 0]}
        mark="tail"
        to={[0.8, height + 0.03, 0]}
      >
        <InlineMath math="W" />
      </Vector>
      <group position={SUPPLY_AT}>
        <Supply share={Math.min(1, current / 5)}>
          <InlineMath math={quantity(current, "\\text{ A}", 1)} />
        </Supply>
      </group>
      <Lead
        color={APPARATUS_COLORS.leadRed}
        flow={current * 0.3}
        points={feeds.out}
        radius={0.016}
      />
      <Lead
        color={APPARATUS_COLORS.leadBlack}
        flow={current * 0.3}
        points={feeds.home}
        radius={0.016}
      />
    </group>
  );
}
