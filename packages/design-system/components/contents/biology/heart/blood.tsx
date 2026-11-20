import { useFrame } from "@react-three/fiber";
import { momentAt } from "@repo/design-system/components/contents/biology/heart/cycle";
import { cutDepth } from "@repo/design-system/components/contents/biology/heart/field";
import {
  advance,
  dropAt,
  forwardFlow,
  LEGS,
  laneOf,
  legRates,
  ROUTES,
} from "@repo/design-system/components/contents/biology/heart/flow";
import {
  usePulse,
  useTissue,
} from "@repo/design-system/components/contents/biology/heart/pulse";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { HEART_COLORS } from "@repo/design-system/lib/material/heart";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { LatheGeometry, Object3D, Vector2 } from "three";

/** How many drops each route carries. */
const DROPS = { arterial: 170, venous: 150 };

/** Blood low in oxygen: dark red, never blue. */
const VENOUS_BLOOD = {
  clearcoat: 0.7,
  clearcoatRoughness: 0.2,
  color: HEART_COLORS.bloodVenous,
  roughness: 0.35,
};

/** Blood full of oxygen: bright red. */
const ARTERIAL_BLOOD = {
  clearcoat: 0.7,
  clearcoatRoughness: 0.2,
  color: HEART_COLORS.bloodArterial,
  roughness: 0.35,
};

/**
 * The shape every drop is drawn in: a red blood cell's biconcave disc, far
 * larger than life (a cell is 8 µm across) so it reads at the scale of a
 * heart, thick at its rim and thin in its middle.
 */
function cellGeometry() {
  const profile = Arr.map(
    [
      [0.001, 0.02],
      [0.07, 0.03],
      [0.12, 0.045],
      [0.145, 0],
      [0.12, -0.045],
      [0.07, -0.03],
      [0.001, -0.02],
    ] as const,
    ([x, y]) => new Vector2(x, y)
  );
  return new LatheGeometry(profile, 12);
}

/**
 * Blood running through the heart while the card plays: dark drops in from
 * the venae cavae through the right heart to the pulmonary trunk, bright
 * drops in from the pulmonary veins through the left heart to the aorta.
 * Each drop moves as fast as blood crosses its stretch of the route at that
 * moment of the beat, so the drops gather in the atria while the ventricles
 * contract, pour through the open atrioventricular valves in diastole and
 * leave through the semilunar valves in systole. A drop in front of the cut
 * lies in tissue the dissection removed, so it is not drawn.
 */
export function Blood() {
  return (
    <group>
      <Drops kind="venous" />
      <Drops kind="arterial" />
    </group>
  );
}

/** The drops of one route, drawn as one instanced mesh. */
function Drops({ kind }: { readonly kind: "arterial" | "venous" }) {
  const { beat, clock } = usePulse();
  const playing = useVisualScene((card) => card.playing, false);
  const count = DROPS[kind];
  const route = ROUTES[kind];
  const lanes = useMemo(
    () => Arr.map(Arr.range(0, count - 1), (index) => laneOf(index, route)),
    [count, route]
  );
  // The drops start spread evenly along the whole route.
  const progress = useMemo(
    () =>
      Float64Array.from(lanes, (_, index) => (LEGS * (index + 0.5)) / count),
    [lanes, count]
  );
  const forward = useMemo(() => forwardFlow(beat), [beat]);
  const geometry = useMemo(cellGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = useTissue(
    kind === "arterial" ? ARTERIAL_BLOOD : VENOUS_BLOOD
  );
  const mesh = useRef<InstancedMesh>(null);
  const point = useMemo(() => [0, 0, 0], []);
  const holder = useMemo(() => new Object3D(), []);

  useFrame((_, delta) => {
    const body = mesh.current;
    if (body === null) {
      return;
    }
    const rates = legRates(momentAt(beat, clock.current), forward, beat.period);
    const step = playing ? simulationStep(delta) : 0;
    for (let index = 0; index < count; index += 1) {
      const lane = Arr.getUnsafe(lanes, index);
      const at = advance(progress[index], lane.speed, rates, step);
      progress[index] = at;
      dropAt(route, lane, at, point);
      const x = Arr.getUnsafe(point, 0);
      const y = Arr.getUnsafe(point, 1);
      const z = Arr.getUnsafe(point, 2);
      holder.position.set(x, y, z);
      holder.rotation.set(lane.angle + at * 4, lane.angle * 2, at * 3);
      holder.scale.setScalar(z > cutDepth(x, y) - 0.15 ? 0 : 1);
      holder.updateMatrix();
      body.setMatrixAt(index, holder.matrix);
    }
    body.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      args={[geometry, material, count]}
      frustumCulled={false}
      ref={mesh}
    />
  );
}
