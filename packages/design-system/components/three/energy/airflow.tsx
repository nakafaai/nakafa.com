import { useFrame } from "@react-three/fiber";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import {
  ROTOR,
  streamRadius,
  windShare,
} from "@repo/design-system/components/three/energy/rotor";
import { chanceAt } from "@repo/design-system/components/three/field/noise";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr } from "effect";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Object3D } from "three";

/** How many smoke streaks mark the air. */
const STREAKS = 54;

/** How far upwind of the rotor a streak enters and how far behind it leaves, in rotor radii. */
const UPWIND = 2.2;
const BEHIND = 2.8;

/** How far from the rotor's axis the outermost streak crosses the rotor's plane, in rotor radii. */
const WIDEST = 1.45;

/** The length of a streak in the free wind and its thickness, in rotor radii. */
const LENGTH = 0.24;
const THICKNESS = 0.0045;

/** Where each streak crosses the rotor's plane, and where along the wind it starts. */
const SEEDS = Arr.makeBy(STREAKS, (streak) => ({
  angle: chanceAt(streak, 2, 13) * 2 * Math.PI,
  radius: 0.12 + Math.sqrt(chanceAt(streak, 1, 11)) * (WIDEST - 0.12),
  start: UPWIND - chanceAt(streak, 3, 17) * (UPWIND + BEHIND),
}));

/** The object every streak is placed through, reused so a frame allocates nothing. */
const PLACER = new Object3D();

/**
 * The wind through a turbine's rotor, shown as a wind tunnel shows it with
 * smoke: thin streaks that drift at the wind's true speed for the rotor's
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
  const places = useMemo(
    () => Float32Array.from(Arr.map(SEEDS, (seed) => seed.start)),
    []
  );

  const place = () => {
    const streaks = mesh.current;
    if (streaks === null) {
      return;
    }
    for (let streak = 0; streak < STREAKS; streak += 1) {
      const seed = SEEDS[streak];
      const downstream = -(places[streak] ?? 0);
      const inside = seed !== undefined && seed.radius < 1;
      const share = inside ? windShare(downstream) : 1;
      const away = streamRadius(seed?.radius ?? 0, downstream);
      const angle = seed?.angle ?? 0;
      const edge = Math.min(
        1,
        (UPWIND + downstream) / 0.5,
        (BEHIND - downstream) / 0.5
      );
      PLACER.position.set(
        Math.cos(angle) * away,
        ROTOR.hub + Math.sin(angle) * away,
        ROTOR.overhang - downstream
      );
      PLACER.scale.set(Math.max(0, edge), Math.max(0, edge), share);
      PLACER.updateMatrix();
      streaks.setMatrixAt(streak, PLACER.matrix);
    }
    streaks.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(place);
  useVisualStop(() => {
    Arr.forEach(SEEDS, (seed, streak) => {
      places[streak] = seed.start;
    });
    place();
  });
  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    const step = (simulationStep(delta) * wind) / metres;
    for (let streak = 0; streak < STREAKS; streak += 1) {
      const at = places[streak] ?? 0;
      const inside = (SEEDS[streak]?.radius ?? 0) < 1;
      const next = at - step * (inside ? windShare(-at) : 1);
      places[streak] = next < -BEHIND ? UPWIND : next;
    }
    place();
  });

  return (
    <group scale={radius}>
      <instancedMesh
        args={[undefined, undefined, STREAKS]}
        frustumCulled={false}
        ref={mesh}
      >
        <boxGeometry args={[THICKNESS, THICKNESS, LENGTH]} />
        <meshBasicMaterial
          color={getColor("WHITE")}
          depthWrite={false}
          opacity={0.62}
          transparent
        />
      </instancedMesh>
    </group>
  );
}
