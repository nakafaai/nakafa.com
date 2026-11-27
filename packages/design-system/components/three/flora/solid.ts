import { LEAF_STRIDE } from "@repo/design-system/components/three/flora/habit";
import type { Mesh } from "@repo/design-system/components/three/flora/limb";
import {
  CELL_STRIDE,
  ZONES,
} from "@repo/design-system/components/three/flora/tissue";
import type { Material } from "three";
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";

/** The triangles of a part of a plant as a geometry a renderer draws. */
export function solidOf(mesh: Mesh) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(mesh.positions, 3)
  );
  geometry.setAttribute("normal", new Float32BufferAttribute(mesh.normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(mesh.uvs, 2));
  geometry.setIndex([...mesh.indices]);
  return geometry;
}

/**
 * Every leaf of a plant as one instanced mesh: one blade drawn once per
 * `LEAF_STRIDE` numbers of `leaves`, each placed, turned, sized and tinted
 * between `deep` and `sun` by its tone, so thousands of leaves cost one draw
 * call and one shared geometry.
 */
export function leavesOf({
  blade,
  deep,
  leaves,
  material,
  sun,
}: {
  readonly blade: BufferGeometry;
  readonly deep: string;
  readonly leaves: readonly number[];
  readonly material: Material;
  readonly sun: string;
}) {
  const count = leaves.length / LEAF_STRIDE;
  const mesh = new InstancedMesh(blade, material, count);
  const matrix = new Matrix4();
  const along = new Vector3();
  const face = new Vector3();
  const side = new Vector3();
  const shade = new Color(deep);
  const light = new Color(sun);
  const tint = new Color();
  for (let index = 0; index < count; index += 1) {
    const at = index * LEAF_STRIDE;
    const size = Number(leaves[at + 9]);
    along.fromArray(leaves, at + 3);
    face.fromArray(leaves, at + 6);
    side.crossVectors(along, face);
    matrix.makeBasis(
      along.multiplyScalar(size),
      face.multiplyScalar(size),
      side.multiplyScalar(size)
    );
    matrix.setPosition(
      Number(leaves[at]),
      Number(leaves[at + 1]),
      Number(leaves[at + 2])
    );
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(
      index,
      tint.lerpColors(shade, light, Number(leaves[at + 10]))
    );
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** The axis a section is cut across: every cell turns about it. */
const OUT = new Vector3(0, 0, 1);

/**
 * Every cell of a section as four instanced meshes that share two
 * geometries: the wall each cell is boxed in, its living body tinted by its
 * zone from `tones`, the vacuole that swells as it grows and its nucleus,
 * which lies against the wall once the vacuole fills the cell and flattens
 * into a plate of chromosomes in a cell caught dividing. `depth` is how far
 * the cells stand out of the cut face.
 */
export function cellsOf({
  ball,
  box,
  cells,
  depth,
  materials,
  tones,
}: {
  readonly ball: BufferGeometry;
  readonly box: BufferGeometry;
  readonly cells: readonly number[];
  readonly depth: number;
  readonly materials: {
    readonly body: Material;
    readonly nucleus: Material;
    readonly vacuole: Material;
    readonly wall: Material;
  };
  readonly tones: readonly [string, string, string, string];
}) {
  const count = cells.length / CELL_STRIDE;
  const walls = new InstancedMesh(box, materials.wall, count);
  const bodies = new InstancedMesh(box, materials.body, count);
  const vacuoles = new InstancedMesh(ball, materials.vacuole, count);
  const nuclei = new InstancedMesh(ball, materials.nucleus, count);
  const matrix = new Matrix4();
  const turn = new Quaternion();
  const place = new Vector3();
  const size = new Vector3();
  const tint = new Color();
  for (let index = 0; index < count; index += 1) {
    const at = index * CELL_STRIDE;
    const x = Number(cells[at]);
    const y = Number(cells[at + 1]);
    const angle = Number(cells[at + 2]);
    const wide = Number(cells[at + 3]);
    const tall = Number(cells[at + 4]);
    const vacuole = Number(cells[at + 5]);
    const nucleus = Number(cells[at + 6]);
    const zone = Number(cells[at + 7]);
    const chance = Number(cells[at + 8]);
    turn.setFromAxisAngle(OUT, angle);
    matrix.compose(
      place.set(x, y, depth * 0.4),
      turn,
      size.set(wide, tall, depth * 0.8)
    );
    walls.setMatrixAt(index, matrix);
    matrix.compose(
      place.set(x, y, depth * 0.5),
      turn,
      size.set(wide * 0.86, Math.max(tall * 0.6, tall - wide * 0.14), depth)
    );
    bodies.setMatrixAt(index, matrix);
    bodies.setColorAt(
      index,
      tint.set(String(tones[zone])).multiplyScalar(0.9 + 0.2 * chance)
    );
    const swollen = vacuole > 0.15 ? 1 : 0;
    matrix.compose(
      place.set(x, y, depth * 0.82),
      turn,
      size.set(
        swollen * wide * 0.66 * Math.sqrt(vacuole),
        swollen * tall * 0.84 * vacuole,
        depth * 0.5
      )
    );
    vacuoles.setMatrixAt(index, matrix);
    const pushed = vacuole > 0.5 ? wide * 0.27 * Math.sign(chance - 0.5) : 0;
    const drift = (chance - 0.5) * tall * 0.4 * swollen;
    const dividing = zone === ZONES.division && chance > 0.8;
    const girth = Math.min(wide * 0.86, tall * 0.7) * nucleus;
    matrix.compose(
      place.set(
        x + Math.cos(angle) * pushed - Math.sin(angle) * drift,
        y + Math.sin(angle) * pushed + Math.cos(angle) * drift,
        depth * 0.96
      ),
      turn,
      dividing
        ? size.set(girth * 1.3, girth * 0.3, girth * 0.7)
        : size.set(girth, girth, girth * 0.8)
    );
    nuclei.setMatrixAt(index, matrix);
  }
  for (const mesh of [walls, bodies, vacuoles, nuclei]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  }
  return { bodies, nuclei, vacuoles, walls };
}
