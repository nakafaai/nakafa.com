import { Line } from "@react-three/drei";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import { Rod } from "@repo/design-system/components/contents/physics/vector/solid/rod";
import {
  type Tugs,
  towResultant,
} from "@repo/design-system/components/contents/physics/vector/tugboat/tow";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";

/** The ship's bow, where both cables are made fast, in scene units of ten metres. */
const BOW = [4, 0.6, 0] as const;

/** How far ahead of the bow each tug runs, in scene units. */
const CABLE = 5.5;

/** Scene units of arrow per kN of pull. */
const ARROW_SCALE = 0.1;

/** A point at a distance from the bow along a heading, degrees toward port from the ship's line. */
function fromBow(distance: number, heading: number, height: number) {
  const turn = (heading * Math.PI) / 180;
  return [
    BOW[0] + Math.cos(turn) * distance,
    height,
    -Math.sin(turn) * distance,
  ] satisfies CoordinateTuple;
}

/** A bulk carrier: dark hull with a red boot top, a long deck of hatches, and the bridge aft. */
function Ship() {
  return (
    <group>
      <mesh castShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[8, 0.9, 1.3]} />
        <meshStandardMaterial color={MATERIAL.hullNavy} roughness={0.55} />
      </mesh>
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[8.02, 0.2, 1.32]} />
        <meshStandardMaterial color={MATERIAL.hullRed} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[4.3, 0.2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[0.92, 0.9, 0.92]} />
        <meshStandardMaterial color={MATERIAL.hullNavy} roughness={0.55} />
      </mesh>
      {Arr.makeBy(6, (index) => (
        <mesh castShadow key={index} position={[-1.8 + index * 1.05, 0.72, 0]}>
          <boxGeometry args={[0.8, 0.14, 0.9]} />
          <meshStandardMaterial color={MATERIAL.hullRed} roughness={0.6} />
        </mesh>
      ))}
      <mesh castShadow position={[-3.3, 1.2, 0]}>
        <boxGeometry args={[0.9, 1.1, 1.1]} />
        <meshStandardMaterial color={MATERIAL.deckWhite} roughness={0.5} />
      </mesh>
      <mesh position={[-2.86, 1.5, 0]}>
        <boxGeometry args={[0.02, 0.18, 0.9]} />
        <meshStandardMaterial color={MATERIAL.tintedGlass} roughness={0.1} />
      </mesh>
    </group>
  );
}

/** A harbour tug: a short red and white hull with a high wheelhouse, facing along its cable. */
function Tug({ heading }: { readonly heading: number }) {
  const at = fromBow(CABLE, heading, 0.1);
  return (
    <group position={at} rotation={[0, (heading * Math.PI) / 180, 0]}>
      <mesh castShadow>
        <boxGeometry args={[1.6, 0.5, 0.7]} />
        <meshStandardMaterial color={MATERIAL.hullRed} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0.85, 0, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color={MATERIAL.hullRed} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0.2, 0.5, 0]}>
        <boxGeometry args={[0.6, 0.5, 0.55]} />
        <meshStandardMaterial color={MATERIAL.deckWhite} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[-0.15, 0.62, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 12]} />
        <meshStandardMaterial color={MATERIAL.signalHousing} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** One pull from the bow with its symbol past the tip. */
function Pull({
  color,
  heading,
  math,
  size,
}: {
  readonly color: string;
  readonly heading: number;
  readonly math: string;
  readonly size: number;
}) {
  const vector = fromBow(size * ARROW_SCALE, heading, 0);
  return (
    <group>
      <FixedArrow
        color={color}
        from={[BOW[0], 1.4, 0]}
        head={0.35}
        thickness={0.05}
        vector={[vector[0] - BOW[0], 0, vector[2]]}
      />
      <ThreeLabel
        color={color}
        fontSize="reading"
        position={fromBow(size * ARROW_SCALE + 0.7, heading, 1.4)}
      >
        <InlineMath math={math} />
      </ThreeLabel>
    </group>
  );
}

/**
 * The ship, both tugs on their cables, the cable forces (teal and amber)
 * drawn from the bow above the deck, the parallelogram they span (dashed),
 * and the resultant along its diagonal (violet).
 */
export function TugboatScene({
  between,
  tugs,
}: {
  readonly between: number;
  readonly tugs: Tugs;
}) {
  const resultant = towResultant(tugs, between);
  const half = between / 2;
  const first = fromBow(tugs.first * ARROW_SCALE, half, 1.4);
  const second = fromBow(tugs.second * ARROW_SCALE, -half, 1.4);
  const tip = fromBow(resultant.size * ARROW_SCALE, resultant.fromLine, 1.4);

  return (
    <group>
      <mesh
        position={[0, -0.05, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial
          color={MATERIAL.water}
          metalness={0.2}
          roughness={0.18}
        />
      </mesh>
      <Ship />
      <Tug heading={half} />
      <Tug heading={-half} />
      <Rod
        color={MATERIAL.hemp}
        from={[BOW[0], 0.6, 0]}
        radius={0.04}
        to={fromBow(CABLE - 0.8, half, 0.35)}
      />
      <Rod
        color={MATERIAL.hemp}
        from={[BOW[0], 0.6, 0]}
        radius={0.04}
        to={fromBow(CABLE - 0.8, -half, 0.35)}
      />
      <Pull
        color={PLOT_COLORS.teal}
        heading={half}
        math="\vec F_1"
        size={tugs.first}
      />
      <Pull
        color={PLOT_COLORS.amber}
        heading={-half}
        math="\vec F_2"
        size={tugs.second}
      />
      <Pull
        color={PLOT_COLORS.violet}
        heading={resultant.fromLine}
        math="\vec R"
        size={resultant.size}
      />
      <Line
        color={getColor("WHITE")}
        dashed
        dashSize={0.25}
        gapSize={0.18}
        lineWidth={1.5}
        points={[first, tip, second]}
      />
    </group>
  );
}
