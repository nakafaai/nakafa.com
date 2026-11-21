import { Instances } from "@repo/design-system/components/contents/biology/instances";
import type { Point } from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import {
  GRANULE_RADIUS,
  GRANULES,
  MITORIBOSOMES,
  NUCLEOID_RADIUS,
  NUCLEOIDS,
  nucleoidLoop,
  RIBOSOME_RADIUS,
} from "@repo/design-system/components/contents/biology/mitochondrion/particles";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { ORGANELLE_COLORS } from "@repo/design-system/lib/material/organelle";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

/** The radius the DNA of a nucleoid is drawn at: 2 nm, thickened as the membranes are, so it reads as a strand. */
const STRAND = 0.0035;

/** One nucleoid: its DNA loop wound back on itself, with the packing proteins along it. */
function Nucleoid({
  centre,
  seed,
}: {
  readonly centre: Point;
  readonly seed: number;
}) {
  const geometry = useMemo(() => {
    const curve = new CatmullRomCurve3(
      Arr.map(nucleoidLoop(centre, seed, 28), (point) => new Vector3(...point)),
      true,
      "centripetal"
    );
    return new TubeGeometry(curve, 220, STRAND, 6, true);
  }, [centre, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const beads = Arr.map(nucleoidLoop(centre, seed, 14), (position) => ({
    position,
  }));
  return (
    <group>
      <mesh castShadow geometry={geometry}>
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={ORGANELLE_COLORS.nucleoid}
          roughness={0.4}
        />
      </mesh>
      <Instances placements={beads}>
        <sphereGeometry args={[NUCLEOID_RADIUS * 0.14, 10, 8]} />
        <meshPhysicalMaterial
          color={ORGANELLE_COLORS.complex}
          roughness={0.5}
        />
      </Instances>
    </group>
  );
}

/** The matrix's own bodies: nucleoids of DNA, dense calcium phosphate granules, and mitochondrial ribosomes. */
export function MatrixBodies() {
  return (
    <group>
      {Arr.map(NUCLEOIDS, (centre, index) => (
        <Nucleoid centre={centre} key={centre[0]} seed={index + 1} />
      ))}
      <Instances
        placements={Arr.map(GRANULES, (position, index) => ({
          position,
          scale: [1, 0.85 + 0.3 * hashUnit(index, 3), 1] as const,
        }))}
      >
        <icosahedronGeometry args={[GRANULE_RADIUS, 2]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          clearcoatRoughness={0.3}
          color={ORGANELLE_COLORS.granule}
          roughness={0.35}
        />
      </Instances>
      <Instances
        placements={Arr.map(MITORIBOSOMES, (position) => ({ position }))}
      >
        <icosahedronGeometry args={[RIBOSOME_RADIUS * 0.9, 1]} />
        <meshStandardMaterial
          color={ORGANELLE_COLORS.ribosome}
          roughness={0.6}
        />
      </Instances>
    </group>
  );
}
