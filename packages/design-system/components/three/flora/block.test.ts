import { describe, expect, it } from "@effect/vitest";
import { blobsOf } from "@repo/design-system/components/three/flora/block";
import type { InstancedMesh } from "three";
import { BoxGeometry, Color, Matrix4, MeshBasicMaterial, Vector3 } from "three";

/** Where one instance of a mesh is and how large it is drawn. */
function instanceAt(mesh: InstancedMesh, index: number) {
  const matrix = new Matrix4();
  mesh.getMatrixAt(index, matrix);
  return {
    place: new Vector3().setFromMatrixPosition(matrix),
    size: new Vector3().setFromMatrixScale(matrix),
  };
}

describe("blobsOf", () => {
  it("draws one shape per cell, stretched to its size and tinted by its tone", () => {
    const mesh = blobsOf({
      blobs: [...[1, 2, 3, 0.1, 0.4, 0.2, 0], ...[0, 0, 0, 1, 1, 1, 1]],
      deep: "#000000",
      material: new MeshBasicMaterial(),
      shape: new BoxGeometry(),
      sun: "#ffffff",
    });
    const light = new Color();
    mesh.getColorAt(1, light);

    expect(mesh.count).toBe(2);
    expect(instanceAt(mesh, 0).place.toArray()).toEqual([1, 2, 3]);
    expect(instanceAt(mesh, 0).size.y).toBeCloseTo(0.4);
    expect(instanceAt(mesh, 0).size.z).toBeCloseTo(0.2);
    expect(light.getHex()).toBe(0xff_ff_ff);
  });
});
