import { useFrame } from "@react-three/fiber";
import {
  type Tow,
  towParts,
} from "@repo/design-system/components/contents/physics/vector/sled/pull";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import { Rod } from "@repo/design-system/components/contents/physics/vector/solid/rod";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

/** Metres of arrow per newton of pull. */
const ARROW_SCALE = 0.02;

/** How far the sled travels in one run on screen, in metres. */
const RUN = 1.8;

/** How fast the sled moves on screen, in m/s. */
const PACE = 0.6;

/** Where the rope is tied on the sled's front, from the sled's middle. */
const HITCH = [0.42, 0.16, 0] as const;

/** The plastic sled with its curled front, two runners, and a load of firewood. */
function Sled() {
  return (
    <group>
      <mesh castShadow position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[0.85, 0.04, 0.42]} />
        <meshStandardMaterial color={MATERIAL.sledPlastic} roughness={0.35} />
      </mesh>
      <mesh
        castShadow
        position={[0.42, 0.11, 0]}
        rotation={[0, 0, Math.PI / 5]}
      >
        <boxGeometry args={[0.14, 0.035, 0.42]} />
        <meshStandardMaterial color={MATERIAL.sledPlastic} roughness={0.35} />
      </mesh>
      {Arr.map([-0.18, 0.18], (z) => (
        <mesh castShadow key={z} position={[0, 0.025, z]}>
          <boxGeometry args={[0.82, 0.03, 0.03]} />
          <meshStandardMaterial
            color={MATERIAL.chrome}
            metalness={0.9}
            roughness={0.3}
          />
        </mesh>
      ))}
      {Arr.makeBy(6, (index) => (
        <mesh
          castShadow
          key={index}
          position={[
            -0.18 + (index % 3) * 0.16,
            0.12 + Math.floor(index / 3) * 0.085,
            (index % 2) * 0.04 - 0.02,
          ]}
          rotation={[Math.PI / 2, 0, 0.1 * (index - 2)]}
        >
          <cylinderGeometry args={[0.045, 0.045, 0.34, 14]} />
          <meshStandardMaterial color={MATERIAL.bark} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

/** A level field of snow with the grooves the runners leave behind. */
function Snow() {
  return (
    <group>
      <mesh
        position={[0, 0.001, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={MATERIAL.snow} roughness={0.92} />
      </mesh>
      {Arr.map([-0.18, 0.18], (z) => (
        <mesh
          key={z}
          position={[-1.5, 0.003, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[6, 0.035]} />
          <meshStandardMaterial color={MATERIAL.snowTrack} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** One force arrow from the hitch with its symbol at the tip. */
function Pull({
  color,
  from,
  math,
  vector,
}: {
  readonly color: string;
  readonly from: CoordinateTuple;
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
      <ThreeLabel
        color={color}
        fontSize="reading"
        position={[
          from[0] +
            vector[0] * (vector[0] === 0 ? 0 : 1.12) +
            (vector[0] === 0 ? 0.2 : 0),
          from[1] +
            vector[1] * (vector[1] === 0 ? 0 : 1.12) +
            (vector[1] === 0 ? -0.12 : 0),
          0.3,
        ]}
      >
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
      <Snow />
      <group ref={holder}>
        <Sled />
        <Rod
          color={MATERIAL.hemp}
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
          math="\vec F"
          vector={[along, up, 0]}
        />
        <Pull
          color={PLOT_COLORS.teal}
          from={[HITCH[0], HITCH[1], 0.02]}
          math="F\cos\theta"
          vector={[along, 0, 0]}
        />
        <Pull
          color={PLOT_COLORS.amber}
          from={[HITCH[0] + along, HITCH[1], 0.02]}
          math="F\sin\theta"
          vector={[0, up, 0]}
        />
      </group>
    </group>
  );
}
