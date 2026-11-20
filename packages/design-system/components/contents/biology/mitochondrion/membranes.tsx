import type { Point } from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import {
  BODY,
  bodyPoint,
  INSET,
} from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { ORGANELLE_COLORS } from "@repo/design-system/lib/material/organelle";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  MeshPhysicalMaterial,
} from "three";

/** How finely each membrane surface is drawn: steps along the organelle and around its half. */
const ALONG = 128;
const AROUND = 56;

/**
 * How bright a membrane is drawn at `point`: mottled a little, as a living
 * surface never takes light evenly, and, for a surface inside the organelle
 * (`deep`), darker the farther back it lies, as the light reaching into the
 * cut falls off.
 */
function shadeOf([x, y, z]: Point, deep: boolean) {
  const mottle = 0.9 + 0.2 * valueNoise(x * 7 + 3, y * 7 + z * 5, 64);
  const depth = deep ? 0.6 + 0.4 * Math.max(0, 1 + z / BODY.radius) : 1;
  return mottle * depth;
}

/** No tint: a surface keeps its material's colour. */
const UNTINTED = new Color(1, 1, 1);

/**
 * A smooth surface through a grid of `rows` by `columns` points, shaded by
 * `shadeOf` and tinted at each point by `tint`. Its faces look along the row
 * direction crossed with the column direction, or the other way with `flip`.
 */
export function gridGeometry(
  rows: number,
  columns: number,
  point: (row: number, column: number) => Point,
  flip: boolean,
  deep: boolean,
  tint: (row: number, column: number) => Color = () => UNTINTED
) {
  const cells = Arr.flatMap(Arr.range(0, rows - 1), (row) =>
    Arr.map(Arr.range(0, columns - 1), (column) => ({
      spot: point(row, column),
      tone: tint(row, column),
    }))
  );
  const positions = Arr.flatMap(cells, ({ spot }) => spot);
  const shades = Arr.flatMap(cells, ({ spot, tone }) => {
    const shade = shadeOf(spot, deep);
    return [shade * tone.r, shade * tone.g, shade * tone.b];
  });
  const index = Arr.flatMap(Arr.range(0, rows - 2), (row) =>
    Arr.flatMap(Arr.range(0, columns - 2), (column) => {
      const corner = row * columns + column;
      const below = corner + columns;
      return flip
        ? [corner, corner + 1, below, corner + 1, below + 1, below]
        : [corner, below, corner + 1, corner + 1, below, below + 1];
    })
  );
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(shades, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A flat band in the plane of the cut between two edges given as pairs of
 * points, facing the reader: the cut face of a membrane or a crista.
 */
export function stripGeometry(pairs: readonly (readonly [Point, Point])[]) {
  const positions = Arr.flatMap(pairs, ([outer, inner]) => [
    ...outer,
    ...inner,
  ]);
  const index = Arr.flatMap(Arr.range(0, pairs.length - 2), (step) => {
    const here = step * 2;
    return [here, here + 1, here + 2, here + 2, here + 1, here + 3];
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    "normal",
    new Float32BufferAttribute(
      Arr.flatMap(Arr.range(0, pairs.length * 2 - 1), () => [0, 0, 1]),
      3
    )
  );
  geometry.setIndex(index);
  return geometry;
}

/**
 * The look of a living membrane: soft and a little waxy, with the velvet
 * sheen of light scattered under its surface and a faint clear coat where
 * it is wet, never a flat colour.
 */
export function useMembraneMaterial(color: string, sheen: string, cut = false) {
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: cut ? 0.1 : 0.35,
        clearcoatRoughness: 0.5,
        color,
        emissive: new Color(color).multiplyScalar(0.06),
        polygonOffset: cut,
        polygonOffsetFactor: cut ? -1 : 0,
        roughness: cut ? 0.7 : 0.52,
        sheen: 1,
        sheenColor: new Color(sheen),
        sheenRoughness: 0.42,
        side: cut ? DoubleSide : FrontSide,
        vertexColors: !cut,
      }),
    [color, cut, sheen]
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

/** One face of a membrane, `inset` in from the outer face, looking outward or in towards the axis. */
function useWall(inset: number, outward: boolean) {
  const geometry = useMemo(
    () =>
      gridGeometry(
        ALONG + 1,
        AROUND + 1,
        (row, column) =>
          bodyPoint(row / ALONG, Math.PI + (column / AROUND) * Math.PI, inset),
        outward,
        !outward
      ),
    [inset, outward]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** The cut face of a membrane between `outer` and `inner` insets: a ring round the whole cut outline. */
function useRim(outer: number, inner: number) {
  const geometry = useMemo(() => {
    const edge = (theta: number, along: number) =>
      [bodyPoint(along, theta, outer), bodyPoint(along, theta, inner)] as const;
    const top = Arr.map(Arr.range(0, ALONG), (step) =>
      edge(2 * Math.PI, step / ALONG)
    );
    const bottom = Arr.map(Arr.range(0, ALONG), (step) =>
      edge(Math.PI, 1 - step / ALONG)
    );
    return stripGeometry(Arr.appendAll(top, bottom));
  }, [inner, outer]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * The two membranes of the organelle, cut open lengthwise: the smooth outer
 * membrane, the intermembrane space, and the inner boundary membrane whose
 * inner face walls the matrix. Each bilayer shows its thickness at the cut,
 * and the intermembrane space between them shows as the same dark space as
 * the lumen of a crista, which opens into it.
 */
export function Membranes() {
  const outerFace = useWall(INSET.outer, true);
  const outerBack = useWall(INSET.outerBack, false);
  const innerFace = useWall(INSET.inner, true);
  const matrixFace = useWall(INSET.matrix, false);
  const outerRim = useRim(INSET.outer, INSET.outerBack);
  const space = useRim(INSET.outerBack, INSET.inner);
  const innerRim = useRim(INSET.inner, INSET.matrix);
  const outer = useMembraneMaterial(
    ORGANELLE_COLORS.outerMembrane,
    ORGANELLE_COLORS.outerSheen
  );
  const inner = useMembraneMaterial(
    ORGANELLE_COLORS.innerMembrane,
    ORGANELLE_COLORS.innerSheen
  );
  const wall = useMembraneMaterial(
    ORGANELLE_COLORS.matrixWall,
    ORGANELLE_COLORS.innerSheen
  );
  const cut = useMembraneMaterial(
    ORGANELLE_COLORS.cutFace,
    ORGANELLE_COLORS.outerSheen,
    true
  );
  const gap = useMembraneMaterial(
    ORGANELLE_COLORS.lumen,
    ORGANELLE_COLORS.innerSheen,
    true
  );
  return (
    <group>
      <mesh castShadow geometry={outerFace} material={outer} receiveShadow />
      <mesh geometry={outerBack} material={outer} receiveShadow />
      <mesh geometry={innerFace} material={inner} receiveShadow />
      <mesh geometry={matrixFace} material={wall} receiveShadow />
      <mesh geometry={outerRim} material={cut} />
      <mesh geometry={space} material={gap} />
      <mesh geometry={innerRim} material={cut} />
    </group>
  );
}
