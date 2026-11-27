import { useFrame } from "@react-three/fiber";
import { Turn } from "@repo/design-system/components/three/form/part";
import { bobProfile } from "@repo/design-system/components/three/instrument/radial";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import type { ReactNode } from "react";
import { useMemo, useRef } from "react";
import type { Group } from "three";

/** The thread's radius, in millimetres. */
const THREAD = 1;

/** The braided thread a bob hangs on. */
function Braid() {
  return (
    <SurfaceMaterial
      color={INSTRUMENT_COLORS.sheet}
      repeat={[1, 60]}
      roughness={0.9}
      surface="cloth"
    />
  );
}

/**
 * A pendulum bob on its thread: a turned ball with an eyelet stud, whose
 * middle hangs `cord` millimetres below the place the thread is held. The
 * thread swings to the angle `swing` gives on each frame, without drawing
 * the scene again. Its child is the material the ball is turned from.
 *
 * It is drawn in scene units, hanging from the origin and swinging along x.
 *
 * @param cord - From where the thread is held to the middle of the ball, in millimetres
 * @param radius - The ball's radius, in millimetres
 * @param round - The radius of the bar the thread is tied round, in millimetres, when it hangs from one
 * @param swing - Reads the thread's angle from the vertical, in radians
 */
export function Bob({
  children,
  cord,
  radius,
  round,
  swing,
}: {
  readonly children: ReactNode;
  readonly cord: number;
  readonly radius: number;
  readonly round?: number;
  readonly swing: () => number;
}) {
  const thread = useRef<Group>(null);
  const profile = useMemo(
    () => bobProfile(radius * MILLIMETRE),
    [radius]
  );
  const top = profile.at(-1)?.[1] ?? 0;
  const long = cord * MILLIMETRE - top;

  useFrame(() => {
    thread.current?.rotation.set(0, 0, swing());
  });

  return (
    <group ref={thread}>
      {round === undefined ? null : (
        <mesh
          castShadow
          position={[0, round * MILLIMETRE, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <torusGeometry
            args={[(round + THREAD) * MILLIMETRE, THREAD * MILLIMETRE, 8, 40]}
          />
          <Braid />
        </mesh>
      )}
      <mesh castShadow position={[0, -long / 2, 0]}>
        <cylinderGeometry
          args={[THREAD * MILLIMETRE, THREAD * MILLIMETRE, long, 8]}
        />
        <Braid />
      </mesh>
      <mesh castShadow position={[0, -cord * MILLIMETRE, 0]}>
        <Turn profile={profile} />
        {children}
      </mesh>
    </group>
  );
}
