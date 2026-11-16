import { MicroscopeField } from "@repo/design-system/components/contents/biology/bacteria/field";
import {
  GRATICULE_DIVISIONS,
  GRATICULE_SPAN,
  MICROMETER_DIVISION,
  type Specimen,
} from "@repo/design-system/components/contents/biology/microscope/optics";
import {
  micrometerLines,
  type SlideCell,
  slideCells,
} from "@repo/design-system/components/contents/biology/microscope/slide";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from "three";

/** The field's radius in its own units, as `MicroscopeField` draws it. */
const FIELD_RADIUS = 60;

/** The stains each specimen takes, as the cell's body, its wall or membrane, and its nucleus. */
const STAIN = {
  cheek: {
    body: MATERIAL.cheekCell,
    edge: MATERIAL.methyleneBlue,
    nucleus: MATERIAL.methyleneDark,
  },
  onion: {
    body: MATERIAL.onionCell,
    edge: MATERIAL.onionWall,
    nucleus: MATERIAL.onionNucleus,
  },
  root: {
    body: MATERIAL.rootCell,
    edge: MATERIAL.rootWall,
    nucleus: MATERIAL.chromatin,
  },
} as const;

/**
 * The view down the eyepiece: the bright field with the specimen drawn at
 * its true size for the field's diameter, and, when the eyepiece carries one,
 * the graticule's scale fixed across the middle of the field whatever the
 * objective.
 *
 * @param diameter - The field's diameter on the slide, in millimetres
 * @param cell - How long one cell of the specimen is, in micrometres
 */
export function EyepieceView({
  cell,
  diameter,
  graticule,
  specimen,
}: {
  readonly cell: number;
  readonly diameter: number;
  readonly graticule: boolean;
  readonly specimen: Specimen;
}) {
  const unitsPerMicrometre = (2 * FIELD_RADIUS) / (diameter * 1000);
  return (
    <MicroscopeField>
      {specimen === "micrometer" ? (
        <Micrometer spacing={MICROMETER_DIVISION * unitsPerMicrometre} />
      ) : (
        <Cells size={cell * unitsPerMicrometre} specimen={specimen} />
      )}
      {graticule && <Graticule />}
      <mesh position={[0, 1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[FIELD_RADIUS, FIELD_RADIUS * 6, 192]} />
        <meshBasicMaterial color={MATERIAL.microscopeDark} toneMapped={false} />
      </mesh>
    </MicroscopeField>
  );
}

/** Fills the triangles of each closed polygon from its first corner. */
function fanPositions(
  outlines: readonly (readonly (readonly [number, number])[])[],
  y: number
) {
  return Arr.flatMap(outlines, (outline) =>
    Arr.flatMap(Arr.range(1, outline.length - 2), (corner) => {
      const [a, b, c] = [outline[0], outline[corner], outline[corner + 1]];
      return a === undefined || b === undefined || c === undefined
        ? []
        : [a[0], y, a[1], c[0], y, c[1], b[0], y, b[1]];
    })
  );
}

/** The segments that draw each closed polygon's edge. */
function edgePositions(
  outlines: readonly (readonly (readonly [number, number])[])[],
  y: number
) {
  return Arr.flatMap(outlines, (outline) =>
    Arr.flatMap(Arr.range(0, outline.length - 1), (corner) => {
      const a = outline[corner];
      const b = outline[(corner + 1) % outline.length];
      return a === undefined || b === undefined
        ? []
        : [a[0], y, a[1], b[0], y, b[1]];
    })
  );
}

/** A circle of `radius` around `middle`, as a closed polygon. */
function circle(
  middle: readonly [number, number],
  radius: number,
  corners = 14
) {
  return Arr.map(Arr.range(0, corners - 1), (corner) => {
    const angle = (corner / corners) * Math.PI * 2;
    return [
      middle[0] + Math.cos(angle) * radius,
      middle[1] + Math.sin(angle) * radius,
    ] as const;
  });
}

/**
 * The stained parts of one cell's nucleus as polygons. A root-tip cell in
 * mitosis shows its chromosomes: thickened in prophase, lined up across the
 * middle in metaphase, pulled into two bands in anaphase, and gathered into
 * two new nuclei in telophase.
 */
function nucleusShapes(cell: SlideCell) {
  const [x, z] = cell.nucleus;
  const r = cell.nucleusRadius;
  const band = (offset: number) =>
    [
      [x - r * 1.3, z + offset - r * 0.2],
      [x + r * 1.3, z + offset - r * 0.2],
      [x + r * 1.3, z + offset + r * 0.2],
      [x - r * 1.3, z + offset + r * 0.2],
    ] as const;
  const rod = (cx: number, cz: number, angle: number, long = r * 0.7) => {
    const along = [Math.cos(angle) * long, Math.sin(angle) * long] as const;
    const across = [
      -Math.sin(angle) * r * 0.14,
      Math.cos(angle) * r * 0.14,
    ] as const;
    return [
      [cx - along[0] - across[0], cz - along[1] - across[1]],
      [cx + along[0] - across[0], cz + along[1] - across[1]],
      [cx + along[0] + across[0], cz + along[1] + across[1]],
      [cx - along[0] + across[0], cz - along[1] + across[1]],
    ] as const;
  };
  const lane = (offset: number, tilt: number) =>
    Arr.map(Arr.range(0, 5), (index) =>
      rod(x + offset, z + (index - 2.5) * r * 0.42, tilt)
    );
  return Match.value(cell.phase).pipe(
    Match.when("interphase", () => [circle(cell.nucleus, r)]),
    Match.when("prophase", () =>
      Arr.map(Arr.range(0, 6), (index) =>
        rod(
          x + Math.cos(index * 2.1) * r * 0.45,
          z + Math.sin(index * 2.1) * r * 0.45,
          index * 1.3,
          r * 0.4
        )
      )
    ),
    Match.when("metaphase", () => lane(0, 0)),
    Match.when("anaphase", () => [
      ...lane(-r * 1.1, 0.25),
      ...lane(r * 1.1, -0.25),
    ]),
    Match.when("telophase", () => [
      circle([x - r * 1.4, z], r * 0.7),
      circle([x + r * 1.4, z], r * 0.7),
      rod(x, z, Math.PI / 2, r * 1.6),
    ]),
    Match.exhaustive
  );
}

/** Builds a buffer geometry from flat positions, and frees it when the scene drops it. */
function useFlatGeometry(positions: readonly number[]) {
  const geometry = useMemo(() => {
    const built = new BufferGeometry();
    built.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return built;
  }, [positions]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** The specimen's cells, each `size` field units long, with their walls and nuclei. */
function Cells({
  size,
  specimen,
}: {
  readonly size: number;
  readonly specimen: "cheek" | "onion" | "root";
}) {
  const cells = useMemo(
    () => slideCells(specimen, size, FIELD_RADIUS),
    [size, specimen]
  );
  const outlines = useMemo(
    () => Arr.map(cells, (cell) => cell.outline),
    [cells]
  );
  const body = useFlatGeometry(
    useMemo(() => fanPositions(outlines, 0), [outlines])
  );
  const edge = useFlatGeometry(
    useMemo(() => edgePositions(outlines, 0.1), [outlines])
  );
  const nuclei = useFlatGeometry(
    useMemo(() => fanPositions(Arr.flatMap(cells, nucleusShapes), 0.2), [cells])
  );
  const stain = STAIN[specimen];
  return (
    <group>
      <mesh geometry={body}>
        <meshBasicMaterial
          color={stain.body}
          opacity={0.5}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      <lineSegments geometry={edge}>
        <lineBasicMaterial color={stain.edge} toneMapped={false} />
      </lineSegments>
      <mesh geometry={nuclei}>
        <meshBasicMaterial
          color={stain.nucleus}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** The engraved scale of a stage micrometer: a line every 10 µm across the field. */
function Micrometer({ spacing }: { readonly spacing: number }) {
  const lines = micrometerLines(spacing, FIELD_RADIUS);
  const positions = useMemo(
    () =>
      Arr.flatMap(lines, (line) => [
        line.x,
        0.1,
        6,
        line.x,
        0.1,
        6 + line.length * 14,
      ]),
    [lines]
  );
  const geometry = useFlatGeometry(positions);
  return (
    <group>
      <mesh position={[0, 0.05, 6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FIELD_RADIUS * 2, 0.35]} />
        <meshBasicMaterial color={MATERIAL.ink} toneMapped={false} />
      </mesh>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={MATERIAL.ink} toneMapped={false} />
      </lineSegments>
    </group>
  );
}

/**
 * The graticule in the eyepiece: a scale of 100 divisions across the middle
 * of the field, numbered every ten. It sits in the eyepiece, not on the
 * slide, so it spans the same share of the field with every objective.
 */
function Graticule() {
  const length = 2 * FIELD_RADIUS * GRATICULE_SPAN;
  const step = length / GRATICULE_DIVISIONS;
  const positions = useMemo(
    () =>
      Arr.flatMap(Arr.range(0, GRATICULE_DIVISIONS), (index) => {
        const tall = index % 10 === 0 ? 7 : index % 5 === 0 ? 5 : 3;
        const x = -length / 2 + index * step;
        return [x, 0.4, 0, x, 0.4, -tall];
      }),
    [length, step]
  );
  const geometry = useFlatGeometry(positions);
  return (
    <group>
      <mesh position={[0, 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length, 0.4]} />
        <meshBasicMaterial color={MATERIAL.graticule} toneMapped={false} />
      </mesh>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={MATERIAL.graticule} toneMapped={false} />
      </lineSegments>
      {Arr.map(Arr.range(0, 10), (index) => (
        <ThreeLabel
          color={MATERIAL.graticule}
          fontSize="compact"
          key={index}
          outlineColor={MATERIAL.microscopeLight}
          outlineWidth={0.02}
          position={[-length / 2 + index * 10 * step, 0.5, -11]}
        >
          {index * 10}
        </ThreeLabel>
      ))}
    </group>
  );
}
