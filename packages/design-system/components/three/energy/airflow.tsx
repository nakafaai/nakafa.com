import { useFrame } from "@react-three/fiber";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import {
  ROTOR,
  streamRadius,
  windShare,
} from "@repo/design-system/components/three/energy/rotor";
import { wispPixels } from "@repo/design-system/components/three/energy/wisp";
import { chanceAt } from "@repo/design-system/components/three/field/noise";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { DataTexture, DoubleSide, LinearFilter, Object3D } from "three";

/** How many smoke streaks mark the air. */
const STREAKS = 54;

/** How far upwind of the rotor a streak enters and how far behind it leaves, in rotor radii. */
const UPWIND = 2.2;
const BEHIND = 2.8;

/** How far from the rotor's axis the innermost and the outermost streak cross the rotor's plane, in rotor radii. */
const NEAREST = 0.12;
const WIDEST = 1.45;

/** The length of a streak in the free wind and its width, in rotor radii. */
const LENGTH = 1.1;
const WIDTH = 0.04;

/** The two cards a streak is drawn on, crossed along the wind so it has body from every side, and how each is turned to lie along the wind. */
const CARDS = [0, Math.PI / 2] as const;

/** How many pixels a wisp's picture has across and along. */
const WISP = [16, 64] as const;

/** Over what distance a streak grows in as it enters and thins out as it leaves, in rotor radii. */
const FADE = 0.5;

/** How far from the axis each streak crosses the rotor's plane, at what angle round it, and where along the wind it starts. */
const RADII = Float32Array.from(
  { length: STREAKS },
  (_, streak) =>
    NEAREST + Math.sqrt(chanceAt(streak, 1, 11)) * (WIDEST - NEAREST)
);
const ANGLES = Float32Array.from(
  { length: STREAKS },
  (_, streak) => chanceAt(streak, 2, 13) * 2 * Math.PI
);
const STARTS = Float32Array.from(
  { length: STREAKS },
  (_, streak) => UPWIND - chanceAt(streak, 3, 17) * (UPWIND + BEHIND)
);

/** The object every streak is placed through, reused so a frame allocates nothing. */
const PLACER = new Object3D();

/** The share of the free wind's speed a streak keeps where it is: the air through the rotor slows, the air round it does not. */
function paceAt(streak: number, downstream: number) {
  return RADII[streak] < 1 ? windShare(downstream) : 1;
}

/** Writes where every streak stands into the instances, from how far downwind each one has drifted. */
function placeStreaks(streaks: InstancedMesh, upwind: Float32Array) {
  for (let streak = 0; streak < STREAKS; streak += 1) {
    const downstream = -upwind[streak];
    const away = streamRadius(RADII[streak], downstream);
    const shown = Math.max(
      0,
      Math.min(1, (UPWIND + downstream) / FADE, (BEHIND - downstream) / FADE)
    );
    PLACER.position.set(
      Math.cos(ANGLES[streak]) * away,
      ROTOR.hub + Math.sin(ANGLES[streak]) * away,
      ROTOR.overhang - downstream
    );
    PLACER.scale.set(shown, paceAt(streak, downstream), 1);
    for (let card = 0; card < CARDS.length; card += 1) {
      PLACER.rotation.set(Math.PI / 2, CARDS[card], 0);
      PLACER.updateMatrix();
      streaks.setMatrixAt(streak * CARDS.length + card, PLACER.matrix);
    }
  }
  streaks.instanceMatrix.needsUpdate = true;
}

/**
 * The wind through a turbine's rotor, shown as a wind tunnel shows it with
 * smoke: soft wisps with no edge that drift at the wind's true speed for the rotor's
 * size, slow to two thirds of it at the rotor and to a third behind it, and
 * spread as the slowed air takes more room. Streaks that miss the rotor keep
 * their speed and bend round the wake. Stands in the turbine's own space.
 *
 * @param radius - The rotor's radius, in scene units
 * @param metres - The rotor's real radius, in metres
 * @param wind - The wind speed, in metres per second
 */
export function Airflow({
  metres,
  radius,
  wind,
}: {
  readonly metres: number;
  readonly radius: number;
  readonly wind: number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const playing = useVisualScene((card) => card.playing, true);
  const upwind = useMemo(() => Float32Array.from(STARTS), []);
  const smoke = useMemo(() => {
    const picture = new DataTexture(wispPixels(...WISP), ...WISP);
    picture.magFilter = LinearFilter;
    picture.minFilter = LinearFilter;
    picture.needsUpdate = true;
    return picture;
  }, []);
  useEffect(() => () => smoke.dispose(), [smoke]);

  useLayoutEffect(() => {
    if (mesh.current) {
      placeStreaks(mesh.current, upwind);
    }
  }, [upwind]);
  useVisualStop(() => {
    upwind.set(STARTS);
    if (mesh.current) {
      placeStreaks(mesh.current, upwind);
    }
  });
  useFrame((_, delta) => {
    if (!(playing && mesh.current)) {
      return;
    }
    const step = (simulationStep(delta) * wind) / metres;
    for (let streak = 0; streak < STREAKS; streak += 1) {
      const next = upwind[streak] - step * paceAt(streak, -upwind[streak]);
      upwind[streak] = next < -BEHIND ? UPWIND : next;
    }
    placeStreaks(mesh.current, upwind);
  });

  return (
    <group scale={radius}>
      <instancedMesh
        args={[undefined, undefined, STREAKS * CARDS.length]}
        frustumCulled={false}
        ref={mesh}
      >
        <planeGeometry args={[WIDTH, LENGTH]} />
        <meshBasicMaterial
          color={getColor("WHITE")}
          depthWrite={false}
          map={smoke}
          opacity={0.3}
          side={DoubleSide}
          transparent
        />
      </instancedMesh>
    </group>
  );
}
