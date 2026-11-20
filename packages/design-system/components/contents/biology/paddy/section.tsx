import { usePaddy } from "@repo/design-system/components/contents/biology/paddy/context";
import {
  LensBody,
  SLICE,
} from "@repo/design-system/components/contents/biology/paddy/lens";
import type { Plant } from "@repo/design-system/components/contents/biology/paddy/oxygen";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { PADDY_COLORS } from "@repo/design-system/lib/material/paddy";
import { Array as Arr, Schema } from "effect";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  Color,
  CylinderGeometry,
  DoubleSide,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";

/**
 * One tissue of a root cross-section, laid out as rings of cells: from
 * radius `inner` to `outer` (in radii of the disc), `layers` rings of `files`
 * cells, `offset` set when alternate rings sit half a cell round as cells in
 * hexagonal packing do, and its colour.
 */
const TissueSchema = Schema.Struct({
  color: Schema.String,
  files: Schema.Finite,
  inner: Schema.Finite,
  layers: Schema.Finite,
  offset: Schema.Boolean,
  outer: Schema.Finite,
  wall: Schema.String,
});
type Tissue = typeof TissueSchema.Type;

/**
 * The tissues of each root, outside in, drawn from the cross-sections of
 * Yamauchi et al. (2019, Front. Plant Sci. 10:259, Figs. 2, 4 and 6). Rice:
 * epidermis, exodermis and lignified sclerenchyma, each one cell thick, a
 * cortex of about ten layers in about 32 radial files (cuboidal packing), the
 * endodermis, and a stele only a sixteenth of the root's area (cortex to stele
 * about 15 to 1). Maize: the same outer layers, a cortex of hexagonally packed
 * cells, and a stele a quarter of the root's area (cortex to stele about
 * 3 to 1).
 */
const TISSUES: Record<Plant, readonly Tissue[]> = {
  dryland: [
    {
      color: PADDY_COLORS.cell,
      files: 70,
      inner: 0.765,
      layers: 1,
      offset: false,
      outer: 0.8,
      wall: PADDY_COLORS.wall,
    },
    {
      color: PADDY_COLORS.cellDeep,
      files: 64,
      inner: 0.73,
      layers: 1,
      offset: false,
      outer: 0.765,
      wall: PADDY_COLORS.lignin,
    },
    {
      color: PADDY_COLORS.cell,
      files: 46,
      inner: 0.44,
      layers: 8,
      offset: true,
      outer: 0.73,
      wall: PADDY_COLORS.wall,
    },
    {
      color: PADDY_COLORS.cellDeep,
      files: 40,
      inner: 0.405,
      layers: 1,
      offset: false,
      outer: 0.44,
      wall: PADDY_COLORS.casparian,
    },
    {
      color: PADDY_COLORS.cell,
      files: 34,
      inner: 0.375,
      layers: 1,
      offset: false,
      outer: 0.405,
      wall: PADDY_COLORS.wall,
    },
    {
      color: PADDY_COLORS.cellDeep,
      files: 26,
      inner: 0.03,
      layers: 7,
      offset: true,
      outer: 0.375,
      wall: PADDY_COLORS.wall,
    },
  ],
  rice: [
    {
      color: PADDY_COLORS.cell,
      files: 64,
      inner: 0.765,
      layers: 1,
      offset: false,
      outer: 0.8,
      wall: PADDY_COLORS.wall,
    },
    {
      color: PADDY_COLORS.cellDeep,
      files: 60,
      inner: 0.73,
      layers: 1,
      offset: false,
      outer: 0.765,
      wall: PADDY_COLORS.lignin,
    },
    {
      color: PADDY_COLORS.lignin,
      files: 56,
      inner: 0.695,
      layers: 1,
      offset: false,
      outer: 0.73,
      wall: PADDY_COLORS.lignin,
    },
    {
      color: PADDY_COLORS.cell,
      files: 32,
      inner: 0.235,
      layers: 10,
      offset: false,
      outer: 0.695,
      wall: PADDY_COLORS.wall,
    },
    {
      color: PADDY_COLORS.cellDeep,
      files: 24,
      inner: 0.205,
      layers: 1,
      offset: false,
      outer: 0.235,
      wall: PADDY_COLORS.casparian,
    },
    {
      color: PADDY_COLORS.cell,
      files: 20,
      inner: 0.18,
      layers: 1,
      offset: false,
      outer: 0.205,
      wall: PADDY_COLORS.wall,
    },
    {
      color: PADDY_COLORS.cellDeep,
      files: 14,
      inner: 0.03,
      layers: 4,
      offset: true,
      outer: 0.18,
      wall: PADDY_COLORS.wall,
    },
  ],
};

/**
 * Whether the cortex cell in `layer` of `file` has died to leave an air
 * space: in rice, lysigenous aerenchyma spans the middle cortex layers in
 * sectors two files wide between radial spokes one file wide, which leaves
 * about half the cortex as air, close to the 0.52 that Yamauchi et al.
 * (2019, Fig. 3A) measured.
 */
function isAirSpace(plant: Plant, tissue: number, layer: number, file: number) {
  const sector = Math.floor(file / 3);
  const inner = hashUnit(sector, 43) > 0.6 ? 3 : 2;
  const outer = hashUnit(sector, 47) > 0.65 ? 7 : 8;
  return (
    plant === "rice" &&
    tissue === 3 &&
    layer >= inner &&
    layer <= outer &&
    !isSpoke(plant, tissue, layer, file)
  );
}

/**
 * Whether a cortex cell is part of a spoke: the strands of crushed cells
 * left standing between rice's air spaces, now and then broken through.
 */
function isSpoke(plant: Plant, tissue: number, layer: number, file: number) {
  return (
    plant === "rice" &&
    tissue === 3 &&
    layer >= 2 &&
    layer <= 8 &&
    file % 3 === 0 &&
    hashUnit(Math.floor(file / 3), 41) < 0.85
  );
}

/** Where each cell of a tissue lies: its middle, its turn, and its size across and along the radius. */
function cellsOf(plant: Plant, tissue: Tissue, index: number) {
  const depth = (tissue.outer - tissue.inner) / tissue.layers;
  return Arr.flatMap(Arr.range(0, tissue.layers - 1), (layer) => {
    const radius = tissue.inner + depth * (layer + 0.5);
    const shift = tissue.offset && layer % 2 === 1 ? 0.5 : 0;
    const living = Arr.filter(
      Arr.range(0, tissue.files - 1),
      (file) =>
        !(
          isAirSpace(plant, index, layer, file) ||
          inVessel(
            plant,
            radius,
            ((file + shift) / tissue.files) * Math.PI * 2,
            depth
          )
        )
    );
    return Arr.map(living, (file) => ({
      across:
        ((2 * Math.PI * radius) / tissue.files) *
        (isSpoke(plant, index, layer, file) ? 0.45 : 1),
      along: depth,
      angle: ((file + shift) / tissue.files) * Math.PI * 2,
      radius,
    }));
  });
}

/**
 * The xylem vessels of the stele, each `[radius from the middle, angle, own
 * radius]`: rice has one large central metaxylem vessel ringed by six more
 * (Rebouillat et al. 2009, Rice 2:15-34); maize a ring of about ten large
 * metaxylem vessels round a pith (Yamauchi et al. 2019, Fig. 2B).
 */
const VESSELS: Record<Plant, readonly (readonly [number, number, number])[]> = {
  dryland: Arr.map(
    Arr.range(0, 9),
    (vessel) => [0.29, (vessel / 10) * Math.PI * 2, 0.042] as const
  ),
  rice: [
    [0, 0, 0.065],
    ...Arr.map(
      Arr.range(0, 5),
      (vessel) => [0.125, (vessel / 6) * Math.PI * 2 + 0.3, 0.026] as const
    ),
  ],
};

/** Whether a stele cell at `radius` and `angle`, `size` across, would lie inside a xylem vessel. */
function inVessel(plant: Plant, radius: number, angle: number, size: number) {
  return Arr.some(VESSELS[plant], ([middle, turn, own]) => {
    const dx = Math.cos(angle) * radius - Math.cos(turn) * middle;
    const dy = Math.sin(angle) * radius - Math.sin(turn) * middle;
    return Math.hypot(dx, dy) < own + size * 0.45;
  });
}

/** A unit prism along z, rounded across, that every cell is drawn from. */
function usePrism() {
  const geometry = useMemo(() => {
    const prism = new CylinderGeometry(0.5, 0.5, 1, 8, 1);
    prism.rotateY(Math.PI / 8);
    prism.rotateX(Math.PI / 2);
    return prism;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * The cells of one root, as two instanced prisms: each cell's wall, filling
 * its place, and its living contents within it, standing a hair proud of
 * the cut. Air spaces have neither.
 */
function Cells() {
  const { plant } = usePaddy();
  const prism = usePrism();
  const walls = useRef<InstancedMesh>(null);
  const contents = useRef<InstancedMesh>(null);
  const cells = useMemo(
    () =>
      Arr.flatMap(TISSUES[plant], (tissue, index) =>
        Arr.map(cellsOf(plant, tissue, index), (cell) => ({ ...cell, tissue }))
      ),
    [plant]
  );

  useLayoutEffect(() => {
    const wall = walls.current;
    const inside = contents.current;
    if (wall === null || inside === null) {
      return;
    }
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const axis = new Vector3(0, 0, 1);
    const tone = new Color();
    Arr.forEach(cells, (cell, index) => {
      const swell = 1.04 + 0.1 * hashUnit(index, 3);
      const angle = cell.angle + (hashUnit(index, 4) - 0.5) * 0.04;
      const radius =
        cell.radius + (hashUnit(index, 5) - 0.5) * cell.along * 0.12;
      const position = new Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0
      );
      turn.setFromAxisAngle(axis, angle);
      matrix.compose(
        position,
        turn,
        new Vector3(cell.along * swell, cell.across * swell, SLICE)
      );
      wall.setMatrixAt(index, matrix);
      wall.setColorAt(index, tone.set(cell.tissue.wall));
      matrix.compose(
        position.setZ(0.004),
        turn,
        new Vector3(cell.along * swell * 0.8, cell.across * swell * 0.8, SLICE)
      );
      inside.setMatrixAt(index, matrix);
      inside.setColorAt(
        index,
        tone
          .set(cell.tissue.color)
          .multiplyScalar(0.93 + 0.12 * hashUnit(index, 7))
      );
    });
    wall.count = cells.length;
    inside.count = cells.length;
    wall.instanceMatrix.needsUpdate = true;
    inside.instanceMatrix.needsUpdate = true;
    if (wall.instanceColor) {
      wall.instanceColor.needsUpdate = true;
    }
    if (inside.instanceColor) {
      inside.instanceColor.needsUpdate = true;
    }
  }, [cells]);

  return (
    <>
      <instancedMesh args={[prism, undefined, cells.length]} ref={walls}>
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh args={[prism, undefined, cells.length]} ref={contents}>
        <meshPhysicalMaterial
          clearcoat={0.6}
          clearcoatRoughness={0.25}
          roughness={0.42}
        />
      </instancedMesh>
    </>
  );
}

/** The xylem vessels: open tubes with pale lignified walls. */
function Vessels() {
  const { plant } = usePaddy();
  return (
    <>
      {Arr.map(VESSELS[plant], ([radius, angle, size]) => (
        <group
          key={`${radius}-${angle}`}
          position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[size, size, SLICE * 1.01, 20, 1, true]} />
            <meshStandardMaterial
              color={PADDY_COLORS.vessel}
              roughness={0.5}
              side={DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0, SLICE / 2 + 0.002]}>
            <ringGeometry args={[size * 0.82, size * 1.08, 24]} />
            <meshStandardMaterial color={PADDY_COLORS.vessel} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/**
 * A slice of one root, magnified about two hundred times, with the soil
 * round it: what a lens held over one root in the mud would show, in a slim
 * metal rim under its glass.
 */
export function RootSection() {
  return (
    <group>
      <LensBody />
      <Cells />
      <Vessels />
    </group>
  );
}
