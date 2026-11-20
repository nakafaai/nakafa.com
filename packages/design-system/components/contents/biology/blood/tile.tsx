import { Cavity } from "@repo/design-system/components/contents/biology/blood/cavity";
import type { Sample } from "@repo/design-system/components/contents/biology/blood/serology";
import {
  agglutinates,
  SERA,
} from "@repo/design-system/components/contents/biology/blood/serology";
import {
  BOWL,
  CAVITY,
  columnX,
  DROP,
  filmShade,
  floorAt,
  poolDepth,
  poolRadius,
  ROWS,
  rowOf,
  rowZ,
  TILE,
} from "@repo/design-system/components/contents/biology/blood/well";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { SEROLOGY_COLORS } from "@repo/design-system/lib/material/serology";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  LatheGeometry,
  MeshPhysicalMaterial,
  Path,
  Shape,
  Vector2,
  Vector3,
} from "three";

/** How far the glaze rounds every edge and every cavity's rim, in metres. */
const ROUND = 0.0005;

/** The radius at which the cavity floor meets the rounding of its rim. */
const RIM = Math.sqrt(BOWL ** 2 - (BOWL - CAVITY.depth + ROUND) ** 2);

/**
 * The tile's body: its outline with a hole at every cavity, extruded and
 * rounded at every edge, so each hole's rim curves down into its cavity.
 */
function createBody() {
  const outline = new Shape();
  const halfX = TILE.width / 2;
  const halfZ = TILE.length / 2;
  outline.moveTo(-halfX + TILE.corner, -halfZ);
  outline.lineTo(halfX - TILE.corner, -halfZ);
  outline.quadraticCurveTo(halfX, -halfZ, halfX, -halfZ + TILE.corner);
  outline.lineTo(halfX, halfZ - TILE.corner);
  outline.quadraticCurveTo(halfX, halfZ, halfX - TILE.corner, halfZ);
  outline.lineTo(-halfX + TILE.corner, halfZ);
  outline.quadraticCurveTo(-halfX, halfZ, -halfX, halfZ - TILE.corner);
  outline.lineTo(-halfX, -halfZ + TILE.corner);
  outline.quadraticCurveTo(-halfX, -halfZ, -halfX + TILE.corner, -halfZ);
  outline.holes = Arr.flatMap(Arr.range(0, ROWS - 1), (row) =>
    Arr.map(Arr.range(0, 2), (column) => {
      const hole = new Path();
      hole.absarc(
        columnX(column),
        -rowZ(row),
        RIM + ROUND,
        0,
        Math.PI * 2,
        true
      );
      return hole;
    })
  );
  const geometry = new ExtrudeGeometry(outline, {
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: ROUND,
    bevelThickness: ROUND,
    curveSegments: 24,
    depth: TILE.height - 2 * ROUND,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, ROUND, 0);
  return geometry;
}

/** A cavity's floor, turned from its rim down to its lowest point, matched to the hole's 48 sides. */
function createBowl() {
  const points = Arr.map(Arr.range(0, 20), (step) => {
    const radius = RIM * (1 - step / 20);
    return new Vector2(Math.max(radius, 0.000_01), -floorAt(radius));
  });
  return new LatheGeometry(points, 48, Math.PI / 2);
}

/** How high a pool's edge rounds over before it meets the floor, and how wide that rounding is, in metres. */
const MENISCUS = { rise: 0.000_22, width: 0.0015 } as const;

/**
 * How far surface tension domes a pool's middle above its level, in metres:
 * a drop a centimetre or so across is only a few capillary lengths wide, so
 * its top is not quite flat and catches the light as a broad highlight.
 */
const DOME = 0.000_18;

/**
 * The surface of a pool of `volume` cubic metres in a cavity, turned from its
 * middle to where it meets the floor, its rim rounded as a drop's is. Each
 * vertex is shaded by the depth of liquid under it, so a film looks paler
 * where it thins at the rim.
 */
function createPool(volume: number) {
  const depth = poolDepth(volume);
  const edge = poolRadius(depth);
  const level = CAVITY.depth - depth;
  const surface = (radius: number) => {
    const into = (radius - (edge - MENISCUS.width)) / MENISCUS.width;
    const round = into <= 0 ? 1 : Math.sqrt(Math.max(0, 1 - into * into));
    const crown = DOME * (1 - (radius / edge) ** 2);
    return -level + MENISCUS.rise * round + crown + 0.000_03;
  };
  const points = Arr.map(Arr.range(0, 28), (step) => {
    const radius = edge * Math.sin(((step / 28) * Math.PI) / 2);
    return new Vector2(Math.max(radius, 0.000_01), surface(radius));
  });
  const geometry = new LatheGeometry(Arr.reverse(points), 64);
  const position = geometry.getAttribute("position");
  const colors = Arr.flatMap(Arr.range(0, position.count - 1), (index) => {
    const radius = Math.hypot(position.getX(index), position.getZ(index));
    const shade = filmShade(surface(radius) + floorAt(radius));
    return [shade, shade, shade];
  });
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** A grain of clumped cells: a small sphere roughened so no two read as beads. */
function createGrain() {
  const geometry = new IcosahedronGeometry(1, 2);
  const position = geometry.getAttribute("position");
  const point = new Vector3();
  for (const index of Arr.range(0, position.count - 1)) {
    point.fromBufferAttribute(position, index);
    const lift =
      0.78 +
      0.34 *
        hashUnit(
          Math.round(point.x * 9 + point.y * 31),
          Math.round(point.z * 17)
        );
    point.multiplyScalar(lift);
    position.setXYZ(index, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The shapes every cavity of the tile shares: the pool of one drop of serum,
 * the pool of serum and blood together, and a grain of clumped cells.
 */
function useCavityShapes() {
  const shapes = useMemo(
    () => ({
      grain: createGrain(),
      mixed: createPool(2 * DROP),
      serum: createPool(DROP),
    }),
    []
  );
  useEffect(
    () => () => {
      shapes.grain.dispose();
      shapes.mixed.dispose();
      shapes.serum.dispose();
    },
    [shapes]
  );
  return shapes;
}

/**
 * The grouping tile on the bench and every cavity in use: one row of three
 * per sample, anti-A, anti-B and anti-D from left to right. The row under
 * test follows the run's clock; every other row shows its finished test.
 */
export function Tile({
  chosen,
  samples,
}: {
  readonly chosen: number;
  readonly samples: readonly Sample[];
}) {
  const shapes = useCavityShapes();
  const parts = useMemo(() => ({ body: createBody(), bowl: createBowl() }), []);
  const glaze = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 0.85,
        clearcoatRoughness: 0.3,
        color: SEROLOGY_COLORS.glaze,
        envMapIntensity: 0.38,
        roughness: 0.42,
        side: DoubleSide,
      }),
    []
  );
  useEffect(
    () => () => {
      parts.body.dispose();
      parts.bowl.dispose();
      glaze.dispose();
    },
    [glaze, parts]
  );

  return (
    <group>
      <mesh castShadow geometry={parts.body} material={glaze} receiveShadow />
      {Arr.flatMap(Arr.range(0, ROWS - 1), (row) =>
        Arr.map(Arr.range(0, 2), (column) => (
          <mesh
            geometry={parts.bowl}
            key={`${row}-${column}`}
            material={glaze}
            position={[columnX(column), TILE.height, rowZ(row)]}
            receiveShadow
          />
        ))
      )}
      {Arr.flatMap(samples, (sample, row) =>
        Arr.map(SERA, (serum, column) => (
          <Cavity
            active={row === chosen}
            column={column}
            grain={shapes.grain}
            key={`${sample.name}-${serum}`}
            mixed={shapes.mixed}
            positive={agglutinates(serum, sample)}
            row={rowOf(row, samples.length)}
            serum={serum}
            serumPool={shapes.serum}
          />
        ))
      )}
    </group>
  );
}
