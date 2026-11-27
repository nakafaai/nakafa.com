import {
  dropAlong,
  dropHeight,
} from "@repo/design-system/components/contents/physics/kinematics/rain/fall";
import { chanceAt } from "@repo/design-system/components/three/field/noise";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { WEATHER_COLORS } from "@repo/design-system/lib/material/weather";
import { Array as Arr } from "effect";
import type { Ref } from "react";
import { useImperativeHandle, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Object3D } from "three";

/** How many drops fall in the box of air around the camera. */
const DROPS = 1600;

/** The box of air the rain fills: along the road, up to the cloud base, and across the road. */
const SPAN = 44;
const CEILING = 11;
const NEAR = 9;
const FAR = -14;

/** How long a drop's streak is exposed for, in seconds: a camera's shutter. */
const SHUTTER = 0.035;

/** What a simulation drives on the rain every frame. */
export interface RainRig {
  /**
   * Lets the rain fall around a camera at `centre` metres along the road,
   * after it has fallen `fallen` metres, at `speed` m/s and leaning `lean`
   * radians toward the way the camera drives, as the camera sees it.
   */
  readonly fall: (
    centre: number,
    fallen: number,
    speed: number,
    lean: number
  ) => void;
}

/**
 * A steady rain as a camera films it: every drop a short bright streak as
 * long as it travels while the shutter is open, falling through a box of
 * air that stays with the camera. Filmed from the roadside the streaks hang
 * straight down; filmed from a moving car they lean toward it, by the angle
 * its speed gives them. One instanced mesh draws every drop.
 *
 * @param ref - What a simulation drives each frame
 */
export function Rain({ ref }: { readonly ref: Ref<RainRig> }) {
  const mesh = useRef<InstancedMesh>(null);
  const place = useMemo(() => new Object3D(), []);
  const drops = useMemo(
    () =>
      Arr.makeBy(DROPS, (index) => ({
        along: chanceAt(index, 1, 61),
        height: chanceAt(index, 2, 61),
        long: 0.7 + 0.6 * chanceAt(index, 3, 61),
        z: FAR + (NEAR - FAR) * chanceAt(index, 4, 61),
      })),
    []
  );

  useImperativeHandle(ref, () => ({
    fall: (centre, fallen, speed, lean) => {
      const rain = mesh.current;
      if (rain === null) {
        return;
      }
      for (let index = 0; index < drops.length; index += 1) {
        const drop = drops[index];
        if (drop === undefined) {
          continue;
        }
        place.position.set(
          dropAlong(drop.along, centre, SPAN),
          dropHeight(drop.height, fallen, CEILING),
          drop.z
        );
        place.rotation.set(0, 0, -lean);
        place.scale.set(1, speed * SHUTTER * drop.long, 1);
        place.updateMatrix();
        rain.setMatrixAt(index, place.matrix);
      }
      rain.instanceMatrix.needsUpdate = true;
    },
  }));

  return (
    <CameraBounds exclude>
      <instancedMesh
        args={[undefined, undefined, DROPS]}
        frustumCulled={false}
        ref={mesh}
      >
        <cylinderGeometry args={[0.006, 0.003, 1, 5]} />
        <meshBasicMaterial
          color={WEATHER_COLORS.rain}
          depthWrite={false}
          opacity={0.5}
          transparent
        />
      </instancedMesh>
    </CameraBounds>
  );
}
