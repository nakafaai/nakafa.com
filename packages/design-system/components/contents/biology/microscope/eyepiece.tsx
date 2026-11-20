import { useThree } from "@react-three/fiber";
import { MicroscopeField } from "@repo/design-system/components/contents/biology/bacteria/field";
import type { Specimen } from "@repo/design-system/components/contents/biology/microscope/optics";
import {
  GRATICULE_DIVISIONS,
  GRATICULE_SPAN,
  MICROMETER_DIVISION,
} from "@repo/design-system/components/contents/biology/microscope/optics";
import type { SlideCell } from "@repo/design-system/components/contents/biology/microscope/slide";
import {
  micrometerLines,
  slideCells,
} from "@repo/design-system/components/contents/biology/microscope/slide";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
} from "three";

/** The field's radius in its own units, as `MicroscopeField` draws it. */
const FIELD_RADIUS = 60;

/** The stains each specimen takes, as the cell's body, its wall or membrane, and its nucleus. */
const STAIN = {
  cheek: {
    body: BIOLOGY_COLORS.cheekCell,
    edge: BIOLOGY_COLORS.methyleneBlue,
    nucleus: BIOLOGY_COLORS.methyleneDark,
  },
  onion: {
    body: BIOLOGY_COLORS.onionCell,
    edge: BIOLOGY_COLORS.onionWall,
    nucleus: BIOLOGY_COLORS.onionNucleus,
  },
  root: {
    body: BIOLOGY_COLORS.rootCell,
    edge: BIOLOGY_COLORS.rootWall,
    nucleus: BIOLOGY_COLORS.chromatinStain,
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
        <meshBasicMaterial
          color={REAGENT_COLORS.microscopeDark}
          toneMapped={false}
        />
      </mesh>
    </MicroscopeField>
  );
}

/** How tall a graticule tick is at division `index`, as a share of the tallest: full every tenth, longer every fifth. */
function tickShare(index: number) {
  if (index % 10 === 0) {
    return 1;
  }
  return index % 5 === 0 ? 5 / 7 : 3 / 7;
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

/** The side of the square the specimen is drawn onto, in texture pixels. */
const SPECIMEN_TEXTURE = 2048;

/** Traces one closed polygon in field units onto a canvas whose pixels are `scale` field units each. */
function tracePolygon(
  context: CanvasRenderingContext2D,
  outline: readonly (readonly [number, number])[],
  scale: number
) {
  context.beginPath();
  for (const [x, z] of outline) {
    context.lineTo((x + FIELD_RADIUS) * scale, (z + FIELD_RADIUS) * scale);
  }
  context.closePath();
}

/**
 * Paints the specimen's cells, their walls and their stained nuclei onto one
 * square texture of the whole field. The GPU samples a texture through its
 * mipmaps, which average a cell drawn a few pixels wide into the tone of the
 * tissue, where lines a pixel wide each would beat against the screen's
 * pixels into moiré. A cell keeps its true size at every objective.
 */
function createSpecimenTexture(
  cells: readonly SlideCell[],
  size: number,
  stain: (typeof STAIN)[keyof typeof STAIN]
) {
  const canvas = document.createElement("canvas");
  canvas.width = SPECIMEN_TEXTURE;
  canvas.height = SPECIMEN_TEXTURE;
  const texture = new CanvasTexture(canvas);
  const context = canvas.getContext("2d");
  if (context === null) {
    return texture;
  }
  const scale = SPECIMEN_TEXTURE / (2 * FIELD_RADIUS);
  context.lineJoin = "round";
  context.lineWidth = Math.max(1.5, size * scale * 0.05);
  for (const cell of cells) {
    tracePolygon(context, cell.outline, scale);
    context.globalAlpha = 0.5;
    context.fillStyle = stain.body;
    context.fill();
    context.globalAlpha = 1;
    context.strokeStyle = stain.edge;
    context.stroke();
  }
  context.fillStyle = stain.nucleus;
  for (const shape of Arr.flatMap(cells, nucleusShapes)) {
    tracePolygon(context, shape, scale);
    context.fill();
  }
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The fewest device pixels a cell is drawn across: enough for its wall and
 * its nucleus to show. A screen with more pixels than that per cell, such as
 * a phone's at three device pixels to the CSS pixel, draws every cell at its
 * true size; a coarser one draws the cells this large, so the low-power view
 * still reads as cells, while the readings keep the true length.
 */
const CELL_PIXELS = 8;

/** The specimen's cells, each `size` field units long, with their walls and nuclei. */
function Cells({
  size,
  specimen,
}: {
  readonly size: number;
  readonly specimen: "cheek" | "onion" | "root";
}) {
  // The field's orthographic camera zooms to its pixels per field unit.
  const pixels = useThree((state) => state.camera.zoom * state.viewport.dpr);
  const drawn = Math.max(size, CELL_PIXELS / pixels);
  const texture = useMemo(
    () =>
      createSpecimenTexture(
        slideCells(specimen, drawn, FIELD_RADIUS),
        drawn,
        STAIN[specimen]
      ),
    [drawn, specimen]
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[FIELD_RADIUS * 2, FIELD_RADIUS * 2]} />
      <meshBasicMaterial
        map={texture}
        side={DoubleSide}
        toneMapped={false}
        transparent
      />
    </mesh>
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
        <meshBasicMaterial color={BIOLOGY_COLORS.ink} toneMapped={false} />
      </mesh>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={BIOLOGY_COLORS.ink} toneMapped={false} />
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
        const tall = 7 * tickShare(index);
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
        <meshBasicMaterial
          color={BIOLOGY_COLORS.graticule}
          toneMapped={false}
        />
      </mesh>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          color={BIOLOGY_COLORS.graticule}
          toneMapped={false}
        />
      </lineSegments>
      {Arr.map(Arr.range(0, 10), (index) => (
        <ThreeLabel
          color={BIOLOGY_COLORS.graticule}
          fontSize="compact"
          key={index}
          outlineColor={REAGENT_COLORS.microscopeLight}
          outlineWidth={0.02}
          position={[-length / 2 + index * 10 * step, 0.5, -11]}
        >
          {index * 10}
        </ThreeLabel>
      ))}
    </group>
  );
}
