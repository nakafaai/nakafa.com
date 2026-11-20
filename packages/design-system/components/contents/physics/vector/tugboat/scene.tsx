import { Line } from "@react-three/drei";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import { Rod } from "@repo/design-system/components/contents/physics/vector/solid/rod";
import { Ship } from "@repo/design-system/components/contents/physics/vector/tugboat/ship";
import type { Tugs } from "@repo/design-system/components/contents/physics/vector/tugboat/tow";
import { towResultant } from "@repo/design-system/components/contents/physics/vector/tugboat/tow";
import {
  TUG_STAPLE,
  TUG_STAPLE_RISE,
  Tug,
} from "@repo/design-system/components/contents/physics/vector/tugboat/tug";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Sea } from "@repo/design-system/components/three/stage/sea";
import { getColor } from "@repo/design-system/lib/color";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";

/** The ship's bow, where both cables are made fast at the fairlead, in scene units of ten metres. */
const BOW = [4, 0.5, 0] as const;

/** The height of the harbour's water. */
const SEA_LEVEL = -0.05;

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

/** The white wash a tug's thrusters throw astern, spreading and fading behind it. */
function Wash() {
  return (
    <group>
      {Arr.map([0, 1, 2], (step) => (
        <mesh
          key={step}
          position={[-1.5 - step * 0.5, 0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[1 + step * 0.6, 0.4 + step * 0.22, 1]}
        >
          <circleGeometry args={[0.34, 28]} />
          <meshStandardMaterial
            color={REAGENT_COLORS.foam}
            depthWrite={false}
            opacity={0.5 - step * 0.14}
            roughness={0.9}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

/** A tug on its cable, facing along it, with its wash astern. */
function TowingTug({ heading }: { readonly heading: number }) {
  return (
    <group
      position={fromBow(CABLE, heading, SEA_LEVEL)}
      rotation={[0, (heading * Math.PI) / 180, 0]}
    >
      <Tug />
      <Wash />
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
      <Sea level={SEA_LEVEL} swell={1.4} />
      <group position={[0, SEA_LEVEL, 0]}>
        <Ship />
      </group>
      <TowingTug heading={half} />
      <TowingTug heading={-half} />
      <Rod
        color={MACHINE_COLORS.hemp}
        from={[BOW[0], BOW[1], 0]}
        radius={0.025}
        to={fromBow(CABLE - TUG_STAPLE, half, SEA_LEVEL + TUG_STAPLE_RISE)}
      />
      <Rod
        color={MACHINE_COLORS.hemp}
        from={[BOW[0], BOW[1], 0]}
        radius={0.025}
        to={fromBow(CABLE - TUG_STAPLE, -half, SEA_LEVEL + TUG_STAPLE_RISE)}
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
