import { BLOB_STRIDE } from "@repo/design-system/components/three/flora/mesophyll";
import type { BufferGeometry, Material } from "three";
import { Color, InstancedMesh, Matrix4 } from "three";

/**
 * Every cell of a block of tissue as one instanced mesh: one shape drawn
 * once per `BLOB_STRIDE` numbers of `blobs`, each placed and stretched to
 * its own width, height and depth and tinted between `deep` and `sun` by its
 * tone, so no two cells of a tissue are quite the same.
 */
export function blobsOf({
  blobs,
  deep,
  material,
  shape,
  sun,
}: {
  readonly blobs: readonly number[];
  readonly deep: string;
  readonly material: Material;
  readonly shape: BufferGeometry;
  readonly sun: string;
}) {
  const count = blobs.length / BLOB_STRIDE;
  const mesh = new InstancedMesh(shape, material, count);
  const matrix = new Matrix4();
  const shade = new Color(deep);
  const light = new Color(sun);
  const tint = new Color();
  for (let index = 0; index < count; index += 1) {
    const at = index * BLOB_STRIDE;
    matrix.makeScale(
      Number(blobs[at + 3]),
      Number(blobs[at + 4]),
      Number(blobs[at + 5])
    );
    matrix.setPosition(
      Number(blobs[at]),
      Number(blobs[at + 1]),
      Number(blobs[at + 2])
    );
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(
      index,
      tint.lerpColors(shade, light, Number(blobs[at + 6]))
    );
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}
