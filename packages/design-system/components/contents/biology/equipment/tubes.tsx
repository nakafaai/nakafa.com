import { profile } from "@repo/design-system/components/contents/biology/equipment/glass";
import { PLACES } from "@repo/design-system/components/contents/biology/equipment/places";
import {
  GlassMaterial,
  LiquidMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Path, Shape } from "three";

/** A test tube's outline with its round bottom: 16 by 150 mm, or 25 by 150 mm for a boiling tube. */
function tubeOutline(radius: number, height: number) {
  return profile([
    ...Arr.map(Arr.range(0, 8), (step) => {
      const angle = (step / 8) * (Math.PI / 2);
      return [
        Math.max(radius * Math.sin(angle), 0.0005),
        radius - radius * Math.cos(angle),
      ] as const;
    }),
    [radius, height - 0.002],
    [radius + 0.0007, height],
  ]);
}

/** The liquid in a tube of inner radius `radius`, its round bottom filled and its surface flat at `level` metres. */
function liquidOutline(radius: number, level: number) {
  return profile([
    ...Arr.map(Arr.range(0, 8), (step) => {
      const angle = (step / 8) * (Math.PI / 2);
      return [
        Math.max(radius * Math.sin(angle), 0.0005),
        0.0008 + radius - radius * Math.cos(angle),
      ] as const;
    }),
    [radius, level],
    [0.0005, level],
  ]);
}

/** A glass tube standing at the origin, with liquid up to `level` metres when it holds some. */
function Tube({
  color,
  level,
  radius,
}: {
  readonly color?: string;
  readonly level?: number;
  readonly radius: number;
}) {
  const points = useMemo(() => tubeOutline(radius, 0.15), [radius]);
  const liquid = useMemo(
    () =>
      level === undefined ? undefined : liquidOutline(radius - 0.0012, level),
    [level, radius]
  );
  return (
    <group>
      <mesh castShadow>
        <latheGeometry args={[points, 40]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.28} />
      </mesh>
      {color !== undefined && liquid !== undefined && (
        <mesh>
          <latheGeometry args={[liquid, 32]} />
          <LiquidMaterial color={color} opacity={0.62} />
        </mesh>
      )}
    </group>
  );
}

/** The rack's six holes along it, 36 mm apart, from its middle. */
const SLOTS = Arr.map(Arr.range(0, 5), (index) => -0.09 + index * 0.036);

/** The rack's middle on the bench, between the test tube and the boiling tube it holds. */
const RACK = [
  PLACES.testTube.base[0] + 0.09 - 0.036,
  PLACES.beaker.base[1],
  PLACES.testTube.base[2],
] as const;

/** The rack's upper board: a 240 by 70 mm plank with six 27 mm holes. */
function createRackBoard() {
  const board = new Shape();
  board.moveTo(-0.12, -0.035);
  board.lineTo(0.12, -0.035);
  board.lineTo(0.12, 0.035);
  board.lineTo(-0.12, 0.035);
  board.closePath();
  board.holes = Arr.map(SLOTS, (x) => {
    const hole = new Path();
    hole.absarc(x, 0, 0.0135, 0, Math.PI * 2, true);
    return hole;
  });
  const geometry = new ExtrudeGeometry(board, {
    bevelEnabled: false,
    curveSegments: 20,
    depth: 0.012,
  });
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/**
 * A wooden rack on the bench holding two spare test tubes, one of them with
 * water; the test tube and the boiling tube the learner can pick stand in
 * it too.
 */
export function TubeRack() {
  const board = useMemo(createRackBoard, []);
  useEffect(() => () => board.dispose(), [board]);
  return (
    <group position={RACK}>
      <mesh castShadow position={[0, 0.004, 0]} receiveShadow>
        <boxGeometry args={[0.24, 0.008, 0.07]} />
        <meshStandardMaterial color={LABORATORY_COLORS.wood} roughness={0.7} />
      </mesh>
      <mesh castShadow geometry={board} position={[0, 0.082, 0]} receiveShadow>
        <meshStandardMaterial color={LABORATORY_COLORS.wood} roughness={0.7} />
      </mesh>
      {Arr.map([-0.114, 0.114] as const, (x) => (
        <mesh castShadow key={x} position={[x, 0.039, 0]}>
          <boxGeometry args={[0.012, 0.062, 0.07]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.wood}
            roughness={0.72}
          />
        </mesh>
      ))}
      <group position={[SLOTS[0] ?? 0, 0.008, 0]}>
        <Tube color={LABORATORY_COLORS.water} level={0.05} radius={0.008} />
      </group>
      <group position={[SLOTS[2] ?? 0, 0.008, 0]}>
        <Tube radius={0.008} />
      </group>
    </group>
  );
}

/** A 16 by 150 mm test tube in the rack, a third full of pale blue copper(II) sulfate solution. */
export function TestTube() {
  return (
    <group position={PLACES.testTube.base}>
      <Tube
        color={LABORATORY_COLORS.copperSulfate}
        level={0.045}
        radius={PLACES.testTube.size[0] / 2}
      />
    </group>
  );
}

/** A 25 by 150 mm boiling tube in the rack, wide enough to boil a liquid without it spurting out, with some water. */
export function BoilingTube() {
  return (
    <group position={PLACES.boilingTube.base}>
      <Tube
        color={LABORATORY_COLORS.water}
        level={0.035}
        radius={PLACES.boilingTube.size[0] / 2}
      />
    </group>
  );
}

/** A glass dropper and its red rubber teat, its axis along +y from the tip. */
const DROPPER = [
  [0.0005, 0],
  [0.0012, 0],
  [0.0016, 0.03],
  [0.0034, 0.04],
  [0.0034, 0.075],
] as const;

/** The teat's outline, a bulb that closes at its end. */
const TEAT = [
  [0.0042, 0],
  [0.0068, 0.008],
  [0.0068, 0.022],
  [0.0045, 0.03],
  [0.0005, 0.031],
] as const;

/** The dropper lying on the bench, tilted so its teat and its tip both rest on the worktop. */
export function Dropper() {
  const glass = useMemo(() => profile(DROPPER), []);
  const teat = useMemo(() => profile(TEAT), []);
  const { base } = PLACES.dropper;
  return (
    <group
      position={[base[0] - 0.05, base[1] + 0.0012, base[2]]}
      rotation={[0, 0, -Math.PI / 2 + Math.asin(0.0056 / 0.1)]}
    >
      <mesh castShadow>
        <latheGeometry args={[glass, 24]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.35} />
      </mesh>
      <mesh castShadow position={[0, 0.07, 0]}>
        <latheGeometry args={[teat, 24]} />
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={LABORATORY_COLORS.teat}
          roughness={0.55}
        />
      </mesh>
    </group>
  );
}
