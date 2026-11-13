import { Line } from "@react-three/drei";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import { Rod } from "@repo/design-system/components/contents/physics/vector/solid/rod";
import { Hull } from "@repo/design-system/components/contents/physics/vector/tugboat/hull";
import { Sea } from "@repo/design-system/components/contents/physics/vector/tugboat/sea";
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

/** The length of the stronger pull's arrow, in scene units; the other arrows keep their proportion to it. */
const LONGEST = 4.5;

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
      <group position={[0, -0.3, 0]}>
        <Hull
          beam={1.3}
          bow={1.6}
          color={MATERIAL.hullNavy}
          height={1}
          length={8.6}
        />
        <Hull
          beam={1.34}
          bow={1.62}
          color={MATERIAL.hullRed}
          height={0.36}
          length={8.64}
        />
      </group>
      {Arr.makeBy(6, (index) => (
        <mesh castShadow key={index} position={[-1.8 + index * 1.05, 0.8, 0]}>
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

/** A harbour tug: a short red hull with a white wheelhouse, facing along its cable, and the white wash its propeller throws astern. */
function Tug({ heading }: { readonly heading: number }) {
  const at = fromBow(CABLE, heading, 0.1);
  return (
    <group position={at} rotation={[0, (heading * Math.PI) / 180, 0]}>
      <group position={[0, -0.25, 0]}>
        <Hull
          beam={0.75}
          bow={0.55}
          color={MATERIAL.hullRed}
          height={0.5}
          length={1.8}
        />
      </group>
      {Arr.map([0, 1, 2], (step) => (
        <mesh
          key={step}
          position={[-1.1 - step * 0.45, -0.02, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[1 + step * 0.5, 0.35 + step * 0.18, 1]}
        >
          <circleGeometry args={[0.3, 24]} />
          <meshStandardMaterial
            color={MATERIAL.foam}
            opacity={0.55 - step * 0.15}
            roughness={0.9}
            transparent
          />
        </mesh>
      ))}
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
  scale,
  size,
}: {
  readonly color: string;
  readonly heading: number;
  readonly math: string;
  readonly scale: number;
  readonly size: number;
}) {
  const vector = fromBow(size * scale, heading, 0);
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
        position={fromBow(size * scale + 0.9, heading, 2.1)}
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
  const scale = LONGEST / Math.max(tugs.first, tugs.second);
  const first = fromBow(tugs.first * scale, half, 1.4);
  const second = fromBow(tugs.second * scale, -half, 1.4);
  const tip = fromBow(resultant.size * scale, resultant.fromLine, 1.4);

  return (
    <group>
      <Sea />
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
        scale={scale}
        size={tugs.first}
      />
      <Pull
        color={PLOT_COLORS.amber}
        heading={-half}
        math="\vec F_2"
        scale={scale}
        size={tugs.second}
      />
      <Pull
        color={PLOT_COLORS.violet}
        heading={resultant.fromLine}
        math="\vec R"
        scale={scale}
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
