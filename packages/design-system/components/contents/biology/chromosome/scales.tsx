import {
  solenoidOf,
  stringOf,
} from "@repo/design-system/components/contents/biology/chromosome/coil";
import {
  Octamers,
  Thread,
} from "@repo/design-system/components/contents/biology/chromosome/thread";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MoleculeModel } from "@repo/design-system/components/three/molecule/kit";
import {
  duplexOf,
  HELIX_RISE,
  helixOf,
  nucleotideOf,
} from "@repo/design-system/components/three/molecule/nucleic";
import { centerOf } from "@repo/design-system/components/three/molecule/shape";
import { Solvent } from "@repo/design-system/components/three/molecule/solvent";
import { useMemo } from "react";

/** How large one angstrom of the nucleotide and of the helix is drawn, in scene units. */
const NUCLEOTIDE_SCALE = 0.105;
const HELIX_SCALE = 0.026;

/** Where the nucleotide's middle stands, and the middle of its atoms in its own frame. */
const NUCLEOTIDE_AT = [0, 0.66, 0] as const;
const NUCLEOTIDE_MIDDLE = [-1.4, 5.6, -0.3] as const;

/**
 * The Dickerson dodecamer, the first B-DNA whose crystal structure was
 * solved (Drew et al. 1981): one full turn and a little more.
 */
const DODECAMER = [
  "C",
  "G",
  "C",
  "G",
  "A",
  "A",
  "T",
  "T",
  "C",
  "G",
  "C",
  "G",
] as const;

/**
 * Where a point of the nucleotide's own frame stands in the scene: the
 * molecule lies on its side, phosphate to the left and base to the right.
 */
function nucleotidePoint(
  [x, y, z]: readonly [number, number, number],
  lift: number
): readonly [number, number, number] {
  return [
    NUCLEOTIDE_AT[0] - (y - NUCLEOTIDE_MIDDLE[1]) * NUCLEOTIDE_SCALE,
    NUCLEOTIDE_AT[1] + (x - NUCLEOTIDE_MIDDLE[0]) * NUCLEOTIDE_SCALE + lift,
    NUCLEOTIDE_AT[2] + (z - NUCLEOTIDE_MIDDLE[2]) * NUCLEOTIDE_SCALE,
  ];
}

/**
 * One nucleotide, deoxyadenosine monophosphate, as a ball and stick model
 * with every atom: the phosphate group, the deoxyribose ring and the adenine
 * base at their real bond lengths and angles, in the water it lives in.
 */
export function NucleotideSpecimen({
  ink,
  parts,
  playing,
}: {
  readonly ink: string;
  readonly parts: Readonly<Record<"base" | "phosphate" | "sugar", string>>;
  readonly playing: boolean;
}) {
  const molecule = useMemo(() => nucleotideOf("A"), []);
  return (
    <group>
      <group
        position={NUCLEOTIDE_AT}
        rotation={[0, 0, Math.PI / 2]}
        scale={NUCLEOTIDE_SCALE}
      >
        <group
          position={[
            -NUCLEOTIDE_MIDDLE[0],
            -NUCLEOTIDE_MIDDLE[1],
            -NUCLEOTIDE_MIDDLE[2],
          ]}
        >
          <MoleculeModel molecule={molecule} style="sticks" />
        </group>
        <group position={[0, 0, -19]}>
          <Solvent count={24} inner={9} outer={13} playing={playing} />
        </group>
      </group>

      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={nucleotidePoint(centerOf(molecule, 0), 0.19)}
      >
        {parts.phosphate}
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={nucleotidePoint(centerOf(molecule, 1), -0.26)}
      >
        {parts.sugar}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={nucleotidePoint(centerOf(molecule, 2), 0.34)}
      >
        {parts.base}
      </ThreeLabel>
    </group>
  );
}

/**
 * The B-DNA double helix as a space-filling model of every heavy atom: twelve
 * base pairs, a little more than one turn, 2 nm across, with the wide major
 * groove and the narrow minor groove between its two phosphate backbones.
 */
export function DoubleHelixSpecimen({
  ink,
  label,
  playing,
}: {
  readonly ink: string;
  readonly label: string;
  readonly playing: boolean;
}) {
  const molecule = useMemo(() => helixOf(duplexOf(DODECAMER)), []);
  const middle = ((DODECAMER.length - 1) * HELIX_RISE) / 2;
  return (
    <group>
      <group
        position={[0, 0.62, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={HELIX_SCALE}
      >
        <group position={[0, 0, -middle]}>
          <MoleculeModel molecule={molecule} style="spheres" />
        </group>
        <Solvent count={36} inner={14} outer={22} playing={playing} />
      </group>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[0, 1.22, 0]}
      >
        {label}
      </ThreeLabel>
    </group>
  );
}

/** How large one nanometre of the nucleosomes and of the fibre is drawn, in scene units. */
const STRING_SCALE = 0.021;
const FIBRE_SCALE = 0.026;

/**
 * Beads on a string, the 11 nm fibre: four nucleosomes, each 147 base pairs
 * of the double helix wrapped 1.65 left-handed turns around its octamer of
 * eight histones, joined by linker DNA.
 */
export function NucleosomeSpecimen({
  ink,
  label,
}: {
  readonly ink: string;
  readonly label: string;
}) {
  const seats = useMemo(() => stringOf(4), []);
  return (
    <group>
      <group position={[0, 0.6, 0]} scale={STRING_SCALE}>
        <Octamers seats={seats} />
        <Thread seats={seats} strands />
      </group>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[0.22, 0.86, 0]}
      >
        {label}
      </ThreeLabel>
    </group>
  );
}

/**
 * The 30 nm chromatin fibre as a solenoid: nucleosomes coiled six to a
 * left-handed turn, 11 nm a turn, on one unbroken thread of DNA.
 */
export function FibreSpecimen({
  ink,
  label,
}: {
  readonly ink: string;
  readonly label: string;
}) {
  const seats = useMemo(() => solenoidOf(30), []);
  return (
    <group>
      <group
        position={[0, 0.62, 0]}
        rotation={[0.2, 0.55, 0]}
        scale={FIBRE_SCALE}
      >
        <Octamers seats={seats} />
        <Thread seats={seats} strands={false} />
      </group>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[0, 1.12, 0]}
      >
        {label}
      </ThreeLabel>
    </group>
  );
}
