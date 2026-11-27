import { describe, expect, it } from "@effect/vitest";
import { LEAF_STRIDE } from "@repo/design-system/components/three/flora/habit";
import { limbMesh } from "@repo/design-system/components/three/flora/limb";
import {
  cellsOf,
  leavesOf,
  solidOf,
} from "@repo/design-system/components/three/flora/solid";
import { ZONES } from "@repo/design-system/components/three/flora/tissue";
import type { InstancedMesh } from "three";
import {
  BoxGeometry,
  Color,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";

/** Where one instance of a mesh is and how large it is drawn. */
function instanceAt(mesh: InstancedMesh, index: number) {
  const matrix = new Matrix4();
  const place = new Vector3();
  const size = new Vector3();
  mesh.getMatrixAt(index, matrix);
  matrix.decompose(place, new Quaternion(), size);
  return { place, size };
}

describe("solidOf", () => {
  it("hands the triangles of a plant part to the renderer unchanged", () => {
    const mesh = limbMesh({
      arc: 1,
      base: 0.1,
      flare: 0,
      furrow: 0,
      path: [
        [0, 0, 0],
        [0, 1, 0],
      ],
      seed: 1,
      sides: 6,
      tip: 0.05,
    });
    const solid = solidOf(mesh);

    expect(solid.getAttribute("position").count).toBe(
      mesh.positions.length / 3
    );
    expect(solid.getAttribute("normal").count).toBe(mesh.normals.length / 3);
    expect(solid.getAttribute("uv").count).toBe(mesh.uvs.length / 2);
    expect(solid.getIndex()?.count).toBe(mesh.indices.length);
  });
});

describe("leavesOf", () => {
  it("draws one blade per leaf, placed, sized and tinted by its tone", () => {
    const leaves = [
      ...[1, 2, 3, 1, 0, 0, 0, 1, 0, 0.5, 0],
      ...[0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 1],
    ];
    const mesh = leavesOf({
      blade: new BoxGeometry(),
      deep: "#000000",
      leaves,
      material: new MeshBasicMaterial(),
      sun: "#ffffff",
    });
    const shade = new Color();
    const light = new Color();
    mesh.getColorAt(0, shade);
    mesh.getColorAt(1, light);

    expect(mesh.count).toBe(leaves.length / LEAF_STRIDE);
    expect(instanceAt(mesh, 0).place.toArray()).toEqual([1, 2, 3]);
    expect(instanceAt(mesh, 0).size.x).toBeCloseTo(0.5);
    expect(instanceAt(mesh, 1).size.x).toBeCloseTo(2);
    expect(shade.getHex()).toBe(0x00_00_00);
    expect(light.getHex()).toBe(0xff_ff_ff);
    expect(mesh.castShadow).toBe(true);
  });
});

describe("cellsOf", () => {
  const dividing = [0, 0, 0, 0.1, 0.1, 0.06, 0.6, ZONES.division, 0.9];
  const resting = [0.2, 0, 0, 0.1, 0.1, 0.06, 0.6, ZONES.division, 0.2];
  const grown = [0.4, 1, 0.5, 0.1, 0.4, 0.86, 0.24, ZONES.mature, 0.9];
  const meshes = cellsOf({
    ball: new SphereGeometry(0.5),
    box: new BoxGeometry(),
    cells: [...dividing, ...resting, ...grown],
    depth: 0.04,
    materials: {
      body: new MeshBasicMaterial(),
      nucleus: new MeshBasicMaterial(),
      vacuole: new MeshBasicMaterial(),
      wall: new MeshBasicMaterial(),
    },
    tones: ["#ff0000", "#00ff00", "#0000ff", "#ffffff"],
  });

  it("boxes every cell in a wall with a smaller living body inside it", () => {
    expect(meshes.walls.count).toBe(3);
    expect(instanceAt(meshes.walls, 2).size.y).toBeCloseTo(0.4);
    expect(instanceAt(meshes.bodies, 2).size.x).toBeLessThan(0.1);
    expect(instanceAt(meshes.bodies, 2).place.x).toBeCloseTo(0.4);
  });

  it("tints a cell's body by the zone it lies in", () => {
    const young = new Color();
    const old = new Color();
    meshes.bodies.getColorAt(1, young);
    meshes.bodies.getColorAt(2, old);

    expect(young.g).toBeGreaterThan(young.r + young.b);
    expect(old.r).toBeCloseTo(old.b);
    expect(old.r).toBeGreaterThan(0.9);
  });

  it("swells a vacuole only in a cell that has started to grow", () => {
    const flat = new Matrix4();
    meshes.vacuoles.getMatrixAt(0, flat);

    expect(Math.hypot(flat.elements[0], flat.elements[1])).toBeCloseTo(0);
    expect(instanceAt(meshes.vacuoles, 2).size.y).toBeGreaterThan(0.25);
  });

  it("flattens the nucleus of a dividing cell into a plate and leaves a resting one round", () => {
    const plate = instanceAt(meshes.nuclei, 0).size;
    const round = instanceAt(meshes.nuclei, 1).size;

    expect(plate.x).toBeGreaterThan(4 * plate.y);
    expect(round.x).toBeCloseTo(round.y);
  });

  it("pushes the nucleus of a grown cell against its wall, turned with the cell", () => {
    const nucleus = instanceAt(meshes.nuclei, 2).place;

    expect(Math.hypot(nucleus.x - 0.4, nucleus.y - 1)).toBeGreaterThan(0.02);
    expect(instanceAt(meshes.nuclei, 1).place.x).toBeCloseTo(0.2);
  });
});
