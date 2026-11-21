import { Instances } from "@repo/design-system/components/contents/biology/instances";
import type { Point } from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import {
  bandAt,
  CYTOSOL_RIBOSOMES,
  ENVELOPE,
  GLYCOGEN,
  GLYCOGEN_RADIUS,
  keptIn,
  MYOFIBRIL,
} from "@repo/design-system/components/contents/biology/mitochondrion/cytosol";
import {
  gridGeometry,
  stripGeometry,
  useMembraneMaterial,
} from "@repo/design-system/components/contents/biology/mitochondrion/membranes";
import { RIBOSOME_RADIUS } from "@repo/design-system/components/contents/biology/mitochondrion/particles";
import type { Cell } from "@repo/design-system/components/contents/biology/mitochondrion/respiration";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { ORGANELLE_COLORS } from "@repo/design-system/lib/material/organelle";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo } from "react";
import {
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Vector3,
} from "three";

/**
 * The cytoplasm around the organelle for `cell`: polysomes everywhere, and a
 * myofibril with glycogen granules in a muscle cell, or the cell envelope
 * where glucose comes in in a yeast cell.
 */
export function Cytoplasm({ cell }: { readonly cell: Cell }) {
  const ribosomes = Arr.filter(CYTOSOL_RIBOSOMES, (point) =>
    keptIn(cell, point, 0.05)
  );
  return (
    <group>
      <Instances
        key={cell}
        placements={Arr.map(ribosomes, (position) => ({ position }))}
      >
        <icosahedronGeometry args={[RIBOSOME_RADIUS, 1]} />
        <meshStandardMaterial
          color={ORGANELLE_COLORS.ribosome}
          roughness={0.6}
        />
      </Instances>
      {Match.value(cell).pipe(
        Match.when("muscle", () => <Muscle />),
        Match.when("yeast", () => <Envelope />),
        Match.exhaustive
      )}
    </group>
  );
}

/** The colour of each band of a sarcomere. */
const BANDS = {
  a: ORGANELLE_COLORS.bandA,
  h: ORGANELLE_COLORS.bandH,
  i: ORGANELLE_COLORS.bandI,
  m: ORGANELLE_COLORS.bandM,
  z: ORGANELLE_COLORS.bandZ,
} as const;

/**
 * A muscle cell's own cytoplasm: a myofibril behind the organelle, banded
 * along its length by its sarcomeres, fluted by the bundles of filaments in
 * it and cut square at both ends of the view, and glycogen granules in the
 * cytosol.
 */
function Muscle() {
  const geometry = useMemo(() => {
    const tube = new CylinderGeometry(
      MYOFIBRIL.radius,
      MYOFIBRIL.radius,
      MYOFIBRIL.length,
      56,
      560,
      false
    );
    tube.rotateZ(Math.PI / 2);
    const position = tube.getAttribute("position");
    const point = new Vector3();
    const tint = new Color();
    const colors = Arr.flatMap(Arr.range(0, position.count - 1), (index) => {
      point.fromBufferAttribute(position, index);
      const angle = Math.atan2(point.z, point.y);
      const flute =
        1 + 0.018 * Math.sin(angle * 30) + 0.01 * Math.sin(angle * 7);
      position.setXYZ(index, point.x, point.y * flute, point.z * flute);
      tint.set(BANDS[bandAt(point.x)]);
      return [tint.r, tint.g, tint.b];
    });
    tube.setAttribute("color", new Float32BufferAttribute(colors, 3));
    tube.computeVertexNormals();
    return tube;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group>
      <mesh geometry={geometry} position={MYOFIBRIL.axis} receiveShadow>
        <meshPhysicalMaterial clearcoat={0.25} roughness={0.55} vertexColors />
      </mesh>
      <Instances placements={Arr.map(GLYCOGEN, (position) => ({ position }))}>
        <icosahedronGeometry args={[GLYCOGEN_RADIUS, 1]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={ORGANELLE_COLORS.glycogen}
          roughness={0.4}
        />
      </Instances>
    </group>
  );
}

/** How finely the envelope is drawn round its arc and back from the cut. */
const ARC = 72;
const BACK = 6;

/** A point of the envelope `radius` from its centre at angle `angle`, `z` from the cut. */
function arcPoint(radius: number, angle: number, z: number): Point {
  const [cx, cy] = ENVELOPE.centre;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), z];
}

/** The angle `step` of `ARC` steps along the envelope's arc. */
function arcAngle(step: number) {
  return ENVELOPE.from + ((ENVELOPE.to - ENVELOPE.from) * step) / ARC;
}

/** One face of the envelope at `radius`, looking into the cell or out of it. */
function useFace(radius: number, outward: boolean) {
  const geometry = useMemo(
    () =>
      gridGeometry(
        ARC + 1,
        BACK + 1,
        (row, column) =>
          arcPoint(radius, arcAngle(row), (-ENVELOPE.depth * column) / BACK),
        outward,
        false
      ),
    [outward, radius]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** The cut face of one layer of the envelope, from `inner` to `outer` radius. */
function useLayer(inner: number, outer: number) {
  const geometry = useMemo(
    () =>
      stripGeometry(
        Arr.map(Arr.range(0, ARC), (step) => {
          const angle = arcAngle(step);
          return [
            arcPoint(outer, angle, 0),
            arcPoint(inner, angle, 0),
          ] as const;
        })
      ),
    [inner, outer]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * A yeast cell's envelope where it crosses the view, cut open with the
 * organelle: the plasma membrane facing the cytoplasm, the pale inner wall
 * of glucan and chitin, and the darker outer wall of mannoproteins with its
 * fibrils standing out from it.
 */
function Envelope() {
  const membraneOut = ENVELOPE.radius + ENVELOPE.membrane;
  const glucanOut = membraneOut + ENVELOPE.glucan;
  const wallOut = glucanOut + ENVELOPE.mannan;
  const inside = useFace(ENVELOPE.radius, false);
  const outside = useFace(wallOut, true);
  const membraneCut = useLayer(ENVELOPE.radius, membraneOut);
  const glucanCut = useLayer(membraneOut, glucanOut);
  const mannanCut = useLayer(glucanOut, wallOut);
  const membrane = useMembraneMaterial(
    ORGANELLE_COLORS.plasmaMembrane,
    ORGANELLE_COLORS.innerSheen
  );
  const wall = useMembraneMaterial(
    ORGANELLE_COLORS.mannan,
    ORGANELLE_COLORS.outerSheen
  );
  const membraneFace = useMembraneMaterial(
    ORGANELLE_COLORS.plasmaMembrane,
    ORGANELLE_COLORS.innerSheen,
    true
  );
  const glucanFace = useMembraneMaterial(
    ORGANELLE_COLORS.glucan,
    ORGANELLE_COLORS.innerSheen,
    true
  );
  const mannanFace = useMembraneMaterial(
    ORGANELLE_COLORS.mannan,
    ORGANELLE_COLORS.outerSheen,
    true
  );
  const fibrils = Arr.map(Arr.range(0, 219), (index) => {
    const angle = arcAngle(ARC * hashUnit(index, 3));
    const z = -0.01 - 0.6 * hashUnit(index, 5) ** 2;
    const lean = (hashUnit(index, 7) - 0.5) * 0.6;
    return {
      position: arcPoint(wallOut + 0.018, angle, z),
      up: [Math.cos(angle + lean), Math.sin(angle + lean), 0] as const,
    };
  });
  return (
    <group>
      <mesh geometry={inside} material={membrane} receiveShadow />
      <mesh geometry={outside} material={wall} />
      <mesh geometry={membraneCut} material={membraneFace} />
      <mesh geometry={glucanCut} material={glucanFace} />
      <mesh geometry={mannanCut} material={mannanFace} />
      <Instances placements={fibrils}>
        <cylinderGeometry args={[0.0035, 0.005, 0.04, 6]} />
        <meshStandardMaterial color={ORGANELLE_COLORS.mannan} roughness={0.7} />
      </Instances>
    </group>
  );
}
