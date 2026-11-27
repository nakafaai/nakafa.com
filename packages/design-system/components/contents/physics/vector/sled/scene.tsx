import { useFrame } from "@react-three/fiber";
import type { Tow } from "@repo/design-system/components/contents/physics/vector/sled/pull";
import { towParts } from "@repo/design-system/components/contents/physics/vector/sled/pull";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import { Rod } from "@repo/design-system/components/contents/physics/vector/solid/rod";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import type { Placement } from "@repo/design-system/components/three/repeat";
import { Repeat } from "@repo/design-system/components/three/repeat";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { ExtrudeGeometry, Shape } from "three";

/** Metres of arrow per newton of pull. */
const ARROW_SCALE = 0.02;

/** How far the sled travels in one run on screen, in metres. */
const RUN = 1.8;

/** How fast the sled moves on screen, in m/s. */
const PACE = 0.6;

/** Where the rope is tied on the sled's front crossbar, from the sled's middle. */
const HITCH = [0.3, 0.12, 0] as const;

/** Where the runners stand across the sled, from its middle. */
const RUNNERS = [-0.19, 0.19] as const;

/** The height of the slatted deck above the snow. */
const DECK = 0.14;

/**
 * One runner in profile: a bent ash blade, flat where it rides the snow and
 * curling up and back into a hook at the front, as a traditional sled's
 * runner is steamed and bent.
 */
function runnerShape(thickness: number) {
  const shape = new Shape();
  shape.moveTo(-0.44, 0);
  shape.lineTo(0.26, 0);
  shape.bezierCurveTo(0.4, 0, 0.47, 0.06, 0.45, 0.15);
  shape.bezierCurveTo(0.44, 0.2, 0.38, 0.215, 0.35, 0.19);
  shape.lineTo(0.35 + thickness * 0.2, 0.19 - thickness);
  shape.bezierCurveTo(0.39, 0.2 - thickness * 1.2, 0.43, 0.17, 0.42, 0.14);
  shape.bezierCurveTo(0.43, 0.08, 0.37, thickness, 0.26, thickness);
  shape.lineTo(-0.44, thickness);
  shape.closePath();
  return shape;
}

/** The steel shoe under a runner's flat, where it meets the snow. */
const SHOE: readonly Placement[] = Arr.map(RUNNERS, (z) => ({
  position: [-0.08, 0.004, z],
}));

/** The knees that carry the deck on the runners, three to a side. */
const KNEES: readonly Placement[] = Arr.flatMap([-0.32, -0.04, 0.22], (x) =>
  Arr.map(RUNNERS, (z) => ({ position: [x, 0.08, z] }))
);

/** The deck's slats, running the sled's length. */
const SLATS: readonly Placement[] = Arr.makeBy(5, (index) => ({
  position: [-0.06, DECK, -0.18 + index * 0.09],
}));

/** The split logs of the load: two on the deck, one nested on top. */
const LOGS: readonly Placement[] = [
  { position: [-0.08, DECK + 0.055, -0.065], rotation: [0, 0.05, Math.PI / 2] },
  { position: [-0.1, DECK + 0.055, 0.065], rotation: [0, -0.04, Math.PI / 2] },
  { position: [-0.07, DECK + 0.145, 0], rotation: [0, 0.07, Math.PI / 2] },
];

/**
 * A traditional wooden runner sled: two bent ash runners shod with steel,
 * curling up into hooks at the front, knees carrying a deck of five slats,
 * a crossbar at the front where the rope is tied, and a load of split
 * firewood with its bark on and its cut ends showing the rings.
 */
function Sled() {
  const runner = useMemo(
    () =>
      new ExtrudeGeometry(runnerShape(0.032), {
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.004,
        bevelThickness: 0.004,
        curveSegments: 20,
        depth: 0.026,
      }),
    []
  );

  useEffect(() => () => runner.dispose(), [runner]);

  return (
    <group>
      {Arr.map(RUNNERS, (z) => (
        <mesh
          castShadow
          geometry={runner}
          key={z}
          position={[0, 0.006, z - 0.013]}
          receiveShadow
        >
          <SurfaceMaterial
            color={MACHINE_COLORS.ash}
            repeat={[3, 3]}
            surface="wood"
          />
        </mesh>
      ))}
      <Repeat placements={SHOE}>
        <boxGeometry args={[0.7, 0.008, 0.024]} />
        <SurfaceMaterial
          color={CAR_COLORS.chrome}
          metalness={1}
          roughness={0.7}
          surface="brushed"
        />
      </Repeat>
      <Repeat placements={KNEES}>
        <boxGeometry args={[0.03, 0.1, 0.024]} />
        <SurfaceMaterial color={MACHINE_COLORS.ash} surface="wood" />
      </Repeat>
      <Repeat placements={SLATS}>
        <boxGeometry args={[0.72, 0.016, 0.07]} />
        <SurfaceMaterial
          color={MACHINE_COLORS.ash}
          repeat={[2, 1]}
          surface="wood"
        />
      </Repeat>
      <mesh castShadow position={[0.3, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.44, 12]} />
        <SurfaceMaterial color={MACHINE_COLORS.ash} surface="wood" />
      </mesh>
      <Repeat placements={LOGS}>
        <cylinderGeometry args={[0.05, 0.055, 0.5, 14]} />
        <SurfaceMaterial
          attach="material-0"
          color={MACHINE_COLORS.logBark}
          repeat={[2, 1]}
          surface="bark"
        />
        <SurfaceMaterial
          attach="material-1"
          color={MACHINE_COLORS.ash}
          surface="wood"
        />
        <SurfaceMaterial
          attach="material-2"
          color={MACHINE_COLORS.ash}
          surface="wood"
        />
      </Repeat>
    </group>
  );
}

/** One force arrow from the hitch, with its symbol beside the arrow where `label` puts it. */
function Pull({
  color,
  from,
  label,
  math,
  vector,
}: {
  readonly color: string;
  readonly from: CoordinateTuple;
  readonly label: CoordinateTuple;
  readonly math: string;
  readonly vector: CoordinateTuple;
}) {
  return (
    <group>
      <FixedArrow
        color={color}
        from={from}
        head={0.06}
        thickness={0.009}
        vector={vector}
      />
      <ThreeLabel color={color} fontSize="reading" position={label}>
        <InlineMath math={math} />
      </ThreeLabel>
    </group>
  );
}

/**
 * The sled moving across the snow on its rope, with the pull along the rope
 * (violet) split tip to tail into the part along the snow (teal) and the
 * part up (amber).
 */
export function SledScene({
  angle,
  tow,
}: {
  readonly angle: number;
  readonly tow: Tow;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const holder = useRef<Group>(null);
  const travel = useRef(RUN / 2);
  const parts = towParts(tow, angle);
  const turn = (angle * Math.PI) / 180;
  const along = parts.along * ARROW_SCALE;
  const up = parts.up * ARROW_SCALE;
  const rope = 2.2;

  useFrame((_, delta) => {
    if (playing) {
      travel.current = (travel.current + Math.min(delta, 0.1) * PACE) % RUN;
    }
    holder.current?.position.set(travel.current - RUN / 2, 0, 0);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <group ref={holder}>
        <Sled />
        <Rod
          color={MACHINE_COLORS.hemp}
          from={HITCH}
          radius={0.008}
          to={[
            HITCH[0] + Math.cos(turn) * rope,
            HITCH[1] + Math.sin(turn) * rope,
            0,
          ]}
        />
        <Pull
          color={PLOT_COLORS.violet}
          from={[HITCH[0], HITCH[1], 0.02]}
          label={[
            HITCH[0] + along * 0.5 - Math.sin(turn) * 0.16,
            HITCH[1] + up * 0.5 + Math.cos(turn) * 0.16,
            0.3,
          ]}
          math="\vec F"
          vector={[along, up, 0]}
        />
        <Pull
          color={PLOT_COLORS.teal}
          from={[HITCH[0], HITCH[1], 0.02]}
          label={[HITCH[0] + along * 0.5, HITCH[1] - 0.14, 0.3]}
          math="F\cos\theta"
          vector={[along, 0, 0]}
        />
        <Pull
          color={PLOT_COLORS.amber}
          from={[HITCH[0] + along, HITCH[1], 0.02]}
          label={[HITCH[0] + along + 0.3, HITCH[1] + up * 0.5, 0.3]}
          math="F\sin\theta"
          vector={[0, up, 0]}
        />
      </group>
    </group>
  );
}
