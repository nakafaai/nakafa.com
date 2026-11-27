import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";
import { Vector2 } from "three";

/** The radius of the bob, in millimetres. */
const BOB = 19;

/** How far the rod stands behind the thread, and how far the stand rises over the pivot. */
const STAND = { above: 46, back: 180, clear: 70 } as const;

/** The base: how wide, thick and deep the cast foot is. */
const BASE = { deep: 150, thick: 16, wide: 250 } as const;

/** The bob's profile from its axis outward, hanging from the origin: an eyelet stud over a turned brass ball. */
const BOB_PROFILE = [
  new Vector2(0, 0),
  new Vector2(1.6, 0),
  new Vector2(1.6, -3),
  new Vector2(3.4, -3.4),
  new Vector2(3.4, -6.2),
  ...Arr.makeBy(33, (step) => {
    const angle = 0.18 + (step / 32) * (Math.PI - 0.18);
    return new Vector2(
      BOB * Math.sin(angle),
      -6.2 - BOB * (Math.cos(0.18) - Math.cos(angle))
    );
  }),
];

/** How far the middle of the bob hangs below the end of the thread. */
const BOB_DROP = 6.2 + BOB * Math.cos(0.18);

/** Bright steel, drawn along a rod. */
function Steel() {
  return (
    <SurfaceMaterial
      bump={0.3}
      color={INSTRUMENT_COLORS.satinChrome}
      metalness={1}
      repeat={[2, 12]}
      roughness={0.28}
      surface="brushed"
    />
  );
}

/** A knurled thumbscrew of a boss head, its axis along y. */
function Thumbscrew() {
  return (
    <group>
      <mesh castShadow position={[0, 7, 0]}>
        <cylinderGeometry args={[2.6, 2.6, 14, 20]} />
        <Steel />
      </mesh>
      <mesh castShadow position={[0, 17, 0]}>
        <cylinderGeometry args={[8, 8, 7, 48]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.satinChrome}
          metalness={1}
          repeat={[10, 1]}
          roughness={0.36}
          surface="knurl"
        />
      </mesh>
    </group>
  );
}

/**
 * A simple pendulum on a retort stand: a cast iron foot, a steel rod, a boss
 * head with its thumbscrews, an arm that ends in a split cork gripping the
 * thread, and a turned brass bob whose middle hangs `length` millimetres
 * below the cork. The thread swings to the angle `swing` gives on each
 * frame, without drawing the scene again.
 *
 * It is drawn in scene units on the bench, with the bob at rest over the
 * origin and swinging along x.
 *
 * @param length - From the cork to the middle of the bob, in millimetres
 * @param swing - Reads the thread's angle from the vertical, in radians
 */
export function Pendulum({
  length,
  swing,
}: {
  readonly length: number;
  readonly swing: () => number;
}) {
  const thread = useRef<Group>(null);
  const pivot = length + STAND.clear;
  const tall = pivot + STAND.above;
  const cord = length - BOB_DROP;

  useFrame(() => {
    thread.current?.rotation.set(0, 0, swing());
  });

  return (
    <group scale={MILLIMETRE}>
      <RoundedBox
        args={[BASE.wide, BASE.thick, BASE.deep]}
        castShadow
        position={[0, BASE.thick / 2, -STAND.back + 40]}
        radius={3}
        receiveShadow
        smoothness={4}
      >
        <SurfaceMaterial
          coat={0.3}
          color={APPARATUS_COLORS.caseDark}
          repeat={[5, 3]}
          roughness={0.5}
          surface="cast"
        />
      </RoundedBox>
      <mesh castShadow position={[0, BASE.thick + 9, -STAND.back]}>
        <cylinderGeometry args={[11, 14, 18, 40]} />
        <SurfaceMaterial
          coat={0.3}
          color={APPARATUS_COLORS.caseDark}
          repeat={[4, 1]}
          roughness={0.5}
          surface="cast"
        />
      </mesh>
      <mesh castShadow position={[0, tall / 2, -STAND.back]}>
        <cylinderGeometry args={[6, 6, tall, 32]} />
        <Steel />
      </mesh>
      <group position={[0, pivot + 14, -STAND.back]}>
        <RoundedBox args={[26, 30, 34]} castShadow radius={3} smoothness={4}>
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.aluminium}
            metalness={0.9}
            repeat={[2, 2]}
            roughness={0.5}
            surface="cast"
          />
        </RoundedBox>
        <group position={[13, 0, -6]} rotation={[0, 0, -Math.PI / 2]}>
          <Thumbscrew />
        </group>
        <group position={[0, 15, 8]}>
          <Thumbscrew />
        </group>
        <mesh
          castShadow
          position={[0, 0, STAND.back / 2 + 4]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[5, 5, STAND.back + 30, 28]} />
          <Steel />
        </mesh>
      </group>
      <group position={[0, pivot + 7, 0]}>
        <RoundedBox
          args={[10, 14, 26]}
          castShadow
          position={[-5.3, 0, 0]}
          radius={1.2}
          smoothness={3}
        >
          <SurfaceMaterial
            color={APPARATUS_COLORS.beechEnd}
            repeat={[2, 2]}
            roughness={0.9}
            surface="wood"
          />
        </RoundedBox>
        <RoundedBox
          args={[10, 14, 26]}
          castShadow
          position={[5.3, 0, 0]}
          radius={1.2}
          smoothness={3}
        >
          <SurfaceMaterial
            color={APPARATUS_COLORS.beechEnd}
            repeat={[2, 2]}
            roughness={0.9}
            surface="wood"
          />
        </RoundedBox>
      </group>
      <group position={[0, pivot, 0]} ref={thread}>
        <mesh castShadow position={[0, -cord / 2, 0]}>
          <cylinderGeometry args={[1, 1, cord, 8]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.sheet}
            repeat={[1, 60]}
            roughness={0.9}
            surface="cloth"
          />
        </mesh>
        <mesh castShadow position={[0, -cord, 0]}>
          <latheGeometry args={[BOB_PROFILE, 72]} />
          <SurfaceMaterial
            bump={0.2}
            color={INSTRUMENT_COLORS.brass}
            metalness={1}
            repeat={[6, 3]}
            roughness={0.24}
            surface="brushed"
          />
        </mesh>
      </group>
    </group>
  );
}
