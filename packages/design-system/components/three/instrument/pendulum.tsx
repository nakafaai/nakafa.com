import { RoundedBox } from "@react-three/drei";
import { Bob } from "@repo/design-system/components/three/instrument/bob";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import { Stand } from "@repo/design-system/components/three/instrument/stand";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";

/** The radius of the bob, in millimetres. */
const BOB = 25;

/** How far the rod stands behind the thread, how far the bob clears the bench, and how far the rod rises over the arm. */
const STAND = { above: 32, back: 180, clear: 70 } as const;

/** How far under the middle of the arm the split cork lets go of the thread, in millimetres. */
const GRIP = 14;

/** One half of the split cork that grips the thread, on its side `side` of it. */
function Cork({ side }: { readonly side: number }) {
  return (
    <RoundedBox
      args={[10, 14, 26]}
      castShadow
      position={[side * 5.3, -GRIP / 2, 0]}
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
  const arm = length + STAND.clear + GRIP;

  return (
    <Stand reach={STAND.back} rise={arm} tall={arm + STAND.above}>
      <group scale={MILLIMETRE}>
        <Cork side={-1} />
        <Cork side={1} />
      </group>
      <group position={[0, -GRIP * MILLIMETRE, 0]}>
        <Bob cord={length} radius={BOB} swing={swing}>
          <SurfaceMaterial
            bump={0.2}
            color={INSTRUMENT_COLORS.brass}
            metalness={1}
            repeat={[6, 3]}
            roughness={0.24}
            surface="brushed"
          />
        </Bob>
      </group>
    </Stand>
  );
}
