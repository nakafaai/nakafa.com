import { BacillusBacteriumModel } from "@repo/design-system/components/contents/biology/bacteria/parts";
import {
  budShare,
  isDividing,
} from "@repo/design-system/components/contents/biology/cell/anatomy";
import { CutNucleus } from "@repo/design-system/components/contents/biology/cell/nucleus";
import {
  Mitochondria,
  Ribosomes,
} from "@repo/design-system/components/contents/biology/cell/organelles";
import { HalfShell } from "@repo/design-system/components/contents/biology/cell/parts";
import type { Placement } from "@repo/design-system/components/contents/biology/instances";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { insideBall } from "@repo/design-system/components/contents/biology/virus/capsid";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { Array as Arr } from "effect";

/** One micrometre of a 5 µm yeast cell drawn 2 units long. */
const YEAST_UM = 1 / 2.5;

/** The yeast mother's half sizes: 5 by 4 by 4 µm. */
const MOTHER = [1, 0.8, 0.8] as const;

/**
 * Bud scars on the back of the mother's wall: raised rings of chitin left
 * where earlier daughters broke away, each facing out from the wall.
 */
const SCARS = Arr.map(
  [
    [-0.55, 0.45, -0.7],
    [-0.15, -0.55, -0.82],
    [0.35, 0.5, -0.78],
  ] as const,
  (direction): Placement => {
    const length = Math.hypot(...direction);
    const up = [
      direction[0] / length,
      direction[1] / length,
      direction[2] / length,
    ] as const;
    return {
      position: [
        up[0] * MOTHER[0] * 1.01,
        up[1] * MOTHER[1] * 1.01,
        up[2] * MOTHER[2] * 1.01,
      ],
      up,
    };
  }
);

/**
 * The nucleus and the vacuole, in the mother's unit frame, which mitochondria
 * and ribosomes keep out of.
 */
const YEAST_KEEPOUT = [
  [0.17, 0.06, -0.23, 0.42],
  [-0.56, -0.13, -0.38, 0.44],
] as const;

/** Polyphosphate granules floating in the yeast vacuole. */
const GRANULES = Arr.map(
  Arr.filter(insideBall(18, 0.28, 23), ([, , z]) => z < 0),
  (point): Placement => ({ position: point })
);

/**
 * A baker's yeast cell, cut open: a thick wall of glucans with chitin, the
 * membrane inside it, a nucleus about 2 µm across, a vacuole, mitochondria
 * and ribosomes. At `minutes` into its cycle a bud swells at one end; late in
 * the cycle the nucleus stretches into the neck to divide.
 */
export function YeastCell({ minutes }: { readonly minutes: number }) {
  const share = budShare(minutes);
  const dividing = isDividing(minutes);
  const neck = MOTHER[0] * 0.92;

  return (
    <group position={[-share * 0.89, 0, 0]}>
      <HalfShell
        color={CELL_COLORS.chitin}
        roughness={0.75}
        scale={MOTHER}
        thickness={0.07}
      />
      <group scale={[0.93, 0.93, 0.93]}>
        <HalfShell
          color={CELL_COLORS.yeastCell}
          scale={MOTHER}
          thickness={0.02}
        />
      </group>
      <group
        position={[dividing ? neck - 0.12 : 0.17, 0.05, -0.18]}
        scale={dividing ? [1.7, 0.75, 0.75] : [1, 1, 1]}
      >
        <CutNucleus position={[0, 0, 0]} radius={0.8 * YEAST_UM} />
      </group>
      <group position={[-0.56, -0.1, -0.3]}>
        <mesh>
          <sphereGeometry args={[0.85 * YEAST_UM, 32, 24]} />
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={CELL_COLORS.vacuole}
            depthWrite={false}
            opacity={0.55}
            roughness={0.1}
            transparent
          />
        </mesh>
        <Instances placements={GRANULES}>
          <sphereGeometry args={[0.02, 10, 8]} />
          <meshStandardMaterial color={CELL_COLORS.nucleolus} roughness={0.6} />
        </Instances>
      </group>
      <Instances placements={SCARS}>
        <torusGeometry args={[0.13, 0.03, 10, 32]} />
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={CELL_COLORS.chitin}
          roughness={0.7}
        />
      </Instances>
      <group scale={MOTHER}>
        <Mitochondria
          avoid={YEAST_KEEPOUT}
          count={7}
          margin={0.2}
          size={YEAST_UM * 0.8}
        />
        <Ribosomes
          avoid={YEAST_KEEPOUT}
          count={260}
          margin={0.12}
          size={YEAST_UM}
        />
      </group>
      {share > 0 && (
        <group
          position={[neck + share * 0.78, 0, 0]}
          scale={[share, share, share]}
        >
          <HalfShell
            color={CELL_COLORS.chitin}
            roughness={0.75}
            scale={MOTHER}
            thickness={0.07}
          />
          <group scale={[0.92, 0.92, 0.92]}>
            <HalfShell
              color={CELL_COLORS.yeastCell}
              scale={MOTHER}
              thickness={0.02}
            />
          </group>
        </group>
      )}
    </group>
  );
}

/**
 * An Escherichia coli rod 2 µm long, cut open: the bacillus of the bacteria
 * labs at this card's scale, its envelope opened on the nucleoid, a plasmid
 * and ribosomes, with fimbriae and flagella.
 */
export function BacteriumCell() {
  return <BacillusBacteriumModel scale={1.25} />;
}
