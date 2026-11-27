import {
  dropAlong,
  dropHeight,
} from "@repo/design-system/components/contents/physics/kinematics/rain/fall";
import { ROAD } from "@repo/design-system/components/contents/physics/kinematics/road";
import { ball } from "@repo/design-system/components/contents/physics/kinematics/round";
import { SEDAN } from "@repo/design-system/components/contents/physics/kinematics/sedan";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { chanceAt } from "@repo/design-system/components/three/field/noise";
import { Turn } from "@repo/design-system/components/three/form/part";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { WEATHER_COLORS } from "@repo/design-system/lib/material/weather";
import { Array as Arr } from "effect";
import type { Ref } from "react";
import { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Matrix4, Object3D, TorusGeometry } from "three";

/** How many drops fall in the box of air around the camera. */
const DROPS = 2400;

/** How many rings spread on the wet road at once, and how many drops the wheels throw up. */
const RINGS = 260;
const SPRAY = 150;

/** The box of air the rain fills: along the road, up to the cloud base, and across the road. */
const SPAN = 44;
const CEILING = 12;
const NEAR = 10;
const FAR = -16;

/** How long a drop's streak is exposed for, in seconds: a camera's slow shutter in dull light. */
const SHUTTER = 0.075;

/** How far a ring spreads before it is gone, in metres, and how many rings a metre of fallen rain starts. */
const RING_REACH = 0.2;
const RING_PACE = 0.32;

/**
 * One streak a metre long, thinner where the drop has just been than where
 * it is, and one mote of spray, as outlines turned about their axes.
 */
const STREAK = [
  [0.0012, -0.5],
  [0.0035, 0.5],
] as const;
const MOTE = ball(0.16);

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
  /**
   * Lets the wheels of a car at `car` metres along the road, driving at
   * `pace` m/s, throw the water on the road up behind them.
   */
  readonly spray: (car: number, pace: number, fallen: number) => void;
}

/**
 * A steady rain as a camera films it in dull light. Every drop is a thin,
 * faint streak as long as it travels while the shutter is open, so the rain
 * near the lens draws long pale lines and the rain far off a fine grey
 * veil; where a drop meets the wet road a ring spreads and dies; and the
 * wheels of a car that drives through it throw a mist up behind them.
 * Filmed from the roadside the streaks hang straight down; filmed from a
 * moving car they lean toward it, by the angle its speed gives them. The
 * drops, the rings and the spray are one instanced mesh each, and nothing
 * is made while they move.
 *
 * @param ref - What a simulation drives each frame
 */
export function Rain({ ref }: { readonly ref: Ref<RainRig> }) {
  const streaks = useRef<InstancedMesh>(null);
  const rings = useRef<InstancedMesh>(null);
  const mist = useRef<InstancedMesh>(null);
  const place = useMemo(() => new Object3D(), []);
  const flat = useMemo(() => new Matrix4(), []);
  const ring = useMemo(
    () => new TorusGeometry(1, 0.035, 4, 28).rotateX(Math.PI / 2),
    []
  );
  useEffect(() => () => ring.dispose(), [ring]);
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
  const marks = useMemo(
    () =>
      Arr.makeBy(RINGS, (index) => ({
        along: chanceAt(index, 5, 67),
        start: chanceAt(index, 6, 67),
        z: ROAD.halfWidth * (2 * chanceAt(index, 7, 67) - 1),
      })),
    []
  );
  const motes = useMemo(
    () =>
      Arr.makeBy(SPRAY, (index) => ({
        lift: 0.35 + 0.65 * chanceAt(index, 8, 71),
        side: index % 2 === 0 ? 1 : -1,
        start: chanceAt(index, 9, 71),
        wide: chanceAt(index, 10, 71) - 0.5,
      })),
    []
  );

  useImperativeHandle(ref, () => ({
    fall: (centre, fallen, speed, lean) => {
      const rain = streaks.current;
      const road = rings.current;
      if (rain === null || road === null) {
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
      for (let index = 0; index < marks.length; index += 1) {
        const mark = marks[index];
        if (mark === undefined) {
          continue;
        }
        const life = (mark.start + fallen * RING_PACE) % 1;
        const reach = RING_REACH * (0.15 + 0.85 * life) * (1 - life * life);
        flat.makeScale(reach, 1, reach);
        flat.setPosition(dropAlong(mark.along, centre, SPAN), 0.012, mark.z);
        road.setMatrixAt(index, flat);
      }
      road.instanceMatrix.needsUpdate = true;
    },
    spray: (car, pace, fallen) => {
      const cloud = mist.current;
      if (cloud === null) {
        return;
      }
      const thrown = Math.min(1, pace / 12);
      for (let index = 0; index < motes.length; index += 1) {
        const mote = motes[index];
        if (mote === undefined) {
          continue;
        }
        const life = (mote.start + fallen * 0.45) % 1;
        const size = thrown * (0.3 + 0.9 * life) * (1 - life);
        flat.makeScale(size, size, size);
        flat.setPosition(
          car + SEDAN.rearAxle - 0.2 - life * (0.5 + 0.16 * pace),
          0.05 + mote.lift * 0.55 * Math.sin(Math.PI * life) * thrown,
          ROAD.lane + (mote.side * SEDAN.track) / 2 + mote.wide * 0.5 * life
        );
        cloud.setMatrixAt(index, flat);
      }
      cloud.instanceMatrix.needsUpdate = true;
    },
  }));

  return (
    <CameraBounds exclude>
      <instancedMesh
        args={[undefined, undefined, DROPS]}
        frustumCulled={false}
        ref={streaks}
      >
        <Turn profile={STREAK} />
        <Matter color={WEATHER_COLORS.rain} of="light" opacity={0.3} />
      </instancedMesh>
      <instancedMesh
        args={[ring, undefined, RINGS]}
        frustumCulled={false}
        ref={rings}
      >
        <Matter color={WEATHER_COLORS.ring} of="light" opacity={0.16} />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, SPRAY]}
        frustumCulled={false}
        ref={mist}
      >
        <Turn profile={MOTE} />
        <Matter color={WEATHER_COLORS.spray} of="light" opacity={0.12} />
      </instancedMesh>
    </CameraBounds>
  );
}
