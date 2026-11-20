import { useFrame, useThree } from "@react-three/fiber";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr } from "effect";
import type { RefObject } from "react";
import { useEffect, useMemo } from "react";
import type { Object3D } from "three";
import {
  DoubleSide,
  FrontSide,
  MeshPhysicalMaterial,
  Plane,
  SphereGeometry,
  Vector3,
} from "three";

/**
 * Lets materials be clipped by planes, so a cutaway can open a cell or a
 * virion. The renderer reads this flag when it compiles a material.
 */
export function useClipping() {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);
}

/**
 * A sphere bumped by smooth noise by about `amplitude` of its radius, for a
 * coccus or a lipid envelope, whose surface is never quite round.
 */
export function useBumpySphere(radius: number, seed: number, amplitude = 0.03) {
  const geometry = useMemo(() => {
    const sphere = new SphereGeometry(radius, 72, 54);
    const position = sphere.getAttribute("position");
    const point = new Vector3();
    for (const index of Arr.range(0, position.count - 1)) {
      point.fromBufferAttribute(position, index).divideScalar(radius);
      const lift =
        1 +
        amplitude *
          (valueNoise(point.x * 9 + seed, point.y * 9 + point.z * 5, 64) - 0.5);
      point.multiplyScalar(radius * lift);
      position.setXYZ(index, point.x, point.y, point.z);
    }
    sphere.computeVertexNormals();
    return sphere;
  }, [amplitude, radius, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * The envelope of a cell or a virion: a waxy, slightly translucent membrane
 * that catches a clear-coat highlight, clipped by `clip` when it is opened.
 * With `wedge`, only what lies beyond every plane is cut away, which opens a
 * wedge rather than a half.
 */
export function EnvelopeMaterial({
  clip,
  color,
  opacity = 1,
  wedge = false,
}: {
  readonly clip: readonly Plane[] | undefined;
  readonly color: string;
  readonly opacity?: number;
  readonly wedge?: boolean;
}) {
  // Clipping planes are set on the material object itself, which JSX props
  // cannot name.
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 0.7,
        clearcoatRoughness: 0.32,
        clipIntersection: wedge,
        clippingPlanes: clip === undefined ? null : [...clip],
        color,
        depthWrite: opacity >= 1,
        opacity,
        roughness: 0.48,
        side: clip === undefined ? FrontSide : DoubleSide,
        transparent: opacity < 1,
      }),
    [clip, color, opacity, wedge]
  );
  useEffect(() => () => material.dispose(), [material]);
  return <primitive attach="material" object={material} />;
}

/**
 * Clipping planes through the origin of `ref`'s object, one for each normal
 * in its own frame, kept in world space as the object moves or turns, since
 * the renderer clips in world space. A material clipped by them opens the
 * object wherever it stands.
 */
export function useLocalPlanes(
  ref: RefObject<Object3D | null>,
  normals: readonly (readonly [number, number, number])[]
) {
  const planes = useMemo(
    () => Arr.map(normals, (normal) => new Plane(new Vector3(...normal), 0)),
    [normals]
  );
  useFrame(() => {
    const target = ref.current;
    if (target === null) {
      return;
    }
    target.updateWorldMatrix(true, false);
    Arr.forEach(planes, (plane, index) => {
      const [x, y, z] = normals[index] ?? [0, 0, 1];
      plane.set(plane.normal.set(x, y, z), 0).applyMatrix4(target.matrixWorld);
    });
  });
  return planes;
}
