import { Array as Arr } from "effect";
import { useLayoutEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  GLSL3,
  type InstancedMesh,
  Matrix4,
  ShaderMaterial,
  Vector3,
} from "three";
import { meshGrid } from "@/lib/island/mesh";
import type { piecesOf } from "@/lib/island/pieces";
import { VOXELS_PER_CELL } from "@/lib/island/terrain";
import { paletteTexture } from "@/lib/island/texture";
import type { VoxelGrid } from "@/lib/island/voxel";

/**
 * Three declares the matrices, `position`, `normal` and, on an instanced mesh,
 * `instanceMatrix`; the voxel's palette index is the mesh's own attribute.
 */
const VERTEX = /* glsl */ `
in float paletteIndex;
out vec3 vNormal;
flat out int vIndex;
void main() {
  mat4 world = modelMatrix * instanceMatrix;
  vNormal = normalize(mat3(world) * normal);
  vIndex = int(paletteIndex + 0.5);
  gl_Position = projectionMatrix * viewMatrix * world * vec4(position, 1.0);
}
`;

/**
 * Lights a face in bands: the sun's angle moves it zero, one or two tones down
 * its own ramp, so every shade is a palette colour. The colour's palette index
 * rides in alpha for the outline pass, and the normal goes to the second target.
 */
const FRAGMENT = /* glsl */ `
uniform sampler2D palette;
uniform vec3 sun;
in vec3 vNormal;
flat in int vIndex;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormal;
void main() {
  vec3 n = normalize(vNormal);
  float light = dot(n, sun);
  int shift = light > 0.7 ? 0 : (light > 0.25 ? -1 : -2);
  int ramp = vIndex / 4;
  int tone = clamp(vIndex - ramp * 4 + shift, 0, 3);
  int index = ramp * 4 + tone;
  outColor = vec4(texelFetch(palette, ivec2(index, 0), 0).rgb, float(index) / 255.0);
  outNormal = vec4(n * 0.5 + 0.5, 1.0);
}
`;

/** The sun as the viewer sees it: from the upper left, a little in front. */
const SUN = new Vector3(-0.14, 0.8, 0.7).normalize();

/** The one voxel material every grid of the island shares. */
function useVoxelMaterial() {
  return useMemo(
    () =>
      new ShaderMaterial({
        fragmentShader: FRAGMENT,
        glslVersion: GLSL3,
        uniforms: {
          palette: { value: paletteTexture() },
          sun: { value: SUN },
        },
        vertexShader: VERTEX,
      }),
    []
  );
}

/** A grid's greedy mesh as a geometry, in voxel units. */
function useGridGeometry(grid: VoxelGrid) {
  return useMemo(() => {
    const mesh = meshGrid(grid);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(mesh.positions, 3));
    geometry.setAttribute("normal", new BufferAttribute(mesh.normals, 3));
    geometry.setAttribute("paletteIndex", new BufferAttribute(mesh.colors, 1));
    geometry.setIndex(new BufferAttribute(mesh.indices, 1));
    geometry.computeBoundingSphere();
    return geometry;
  }, [grid]);
}

/** One placement of a grid: the world point its pivot voxel sits on, and its turn. */
type GridPlacement = Pick<
  ReturnType<typeof piecesOf>[number],
  "angle" | "center" | "pivot"
>;

/**
 * Draws a voxel grid at every placement given, as one instanced mesh: scaled so
 * eight voxels make a cell, turned about its pivot, and set on its point.
 */
export function VoxelMesh({
  grid,
  placements,
}: {
  grid: VoxelGrid;
  placements: readonly GridPlacement[];
}) {
  const geometry = useGridGeometry(grid);
  const material = useVoxelMaterial();
  const ref = (mesh: InstancedMesh | null) => {
    if (mesh === null) {
      return;
    }
    const scale = new Matrix4().makeScale(
      1 / VOXELS_PER_CELL,
      1 / VOXELS_PER_CELL,
      1 / VOXELS_PER_CELL
    );
    Arr.forEach(placements, (placement, index) => {
      const [px, py, pz] = placement.pivot;
      const [cx, cy, cz] = placement.center;
      const matrix = new Matrix4()
        .makeTranslation(cx, cy, cz)
        .multiply(new Matrix4().makeRotationY(placement.angle))
        .multiply(scale)
        .multiply(new Matrix4().makeTranslation(-px, -py, -pz));
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };
  useLayoutEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry]
  );
  return (
    <instancedMesh
      args={[geometry, material, placements.length]}
      frustumCulled={false}
      key={placements.length}
      ref={ref}
    />
  );
}
