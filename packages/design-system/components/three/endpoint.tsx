"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  clipOpenLineEnds,
  type LineEndpoints,
} from "@repo/design-system/lib/geometry/endpoint";
import { type ComponentProps, type ComponentRef, useMemo, useRef } from "react";
import {
  InterleavedBufferAttribute,
  Matrix4,
  type Mesh,
  type MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";

/** Keeps a real open endpoint hollow as the learner orbits or zooms. */
export function EndpointLine({
  points,
  endpoints,
  radius,
  lineWidth = 1,
  ...props
}: Omit<ComponentProps<typeof Line>, "points"> & {
  points: readonly Vector3[];
  endpoints: LineEndpoints;
  radius: number;
}) {
  const strokeWidth = props.linewidth ?? lineWidth;
  const line = useRef<ComponentRef<typeof Line>>(null);
  const previous = useMemo(
    () => ({
      points,
      endpoints,
      radius,
      lineWidth: strokeWidth,
      width: 0,
      height: 0,
      view: new Matrix4().multiplyScalar(0),
      projection: new Matrix4().multiplyScalar(0),
      world: new Matrix4().multiplyScalar(0),
    }),
    [points, endpoints, radius, strokeWidth]
  );

  useFrame(({ camera, size }) => {
    if (!line.current) {
      return;
    }
    camera.updateMatrixWorld();
    line.current.updateWorldMatrix(true, false);
    if (
      previous.view.equals(camera.matrixWorldInverse) &&
      previous.projection.equals(camera.projectionMatrix) &&
      previous.world.equals(line.current.matrixWorld) &&
      previous.width === size.width &&
      previous.height === size.height
    ) {
      return;
    }
    previous.view.copy(camera.matrixWorldInverse);
    previous.projection.copy(camera.projectionMatrix);
    previous.world.copy(line.current.matrixWorld);
    previous.width = size.width;
    previous.height = size.height;
    const clipped = clipOpenLineEnds(
      previous.points,
      previous.endpoints,
      camera,
      previous.radius,
      previous.world,
      { width: size.width, height: size.height, lineWidth: previous.lineWidth }
    );
    line.current.visible = clipped.length > 1;
    if (clipped.length < 2) {
      return;
    }
    const geometry = line.current.geometry;
    const start = geometry.getAttribute("instanceStart");
    if (
      start instanceof InterleavedBufferAttribute &&
      start.count === clipped.length - 1
    ) {
      for (let index = 0; index < clipped.length - 1; index += 1) {
        clipped[index].toArray(start.data.array, index * 6);
        clipped[index + 1].toArray(start.data.array, index * 6 + 3);
      }
      start.data.needsUpdate = true;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    } else {
      geometry.setPositions(clipped.flatMap((point) => point.toArray()));
    }
  });

  return <Line {...props} lineWidth={lineWidth} points={points} ref={line} />;
}

/** Faces the camera in world space while retaining inherited marker scale. */
export function EndpointRing({
  position,
  radius,
  material,
}: {
  position: Vector3;
  radius: number;
  material: MeshBasicMaterial;
}) {
  const ring = useRef<Mesh>(null);
  const transform = useMemo(
    () => ({
      position: new Vector3(),
      scale: new Vector3(),
      rotation: new Quaternion(),
      world: new Matrix4(),
    }),
    []
  );

  // R3F owns the per-frame transform and declarative geometry lifecycle.
  useFrame(({ camera }) => {
    const mesh = ring.current;
    if (!mesh?.parent) {
      return;
    }
    mesh.parent.updateWorldMatrix(true, false);
    const parent = mesh.parent.matrixWorld;
    transform.position.copy(position).applyMatrix4(parent);
    transform.scale.setFromMatrixScale(parent);
    camera.getWorldQuaternion(transform.rotation);
    transform.world.compose(
      transform.position,
      transform.rotation,
      transform.scale
    );
    mesh.matrix.copy(parent).invert().multiply(transform.world);
    mesh.updateMatrixWorld(true);
  });

  return (
    // biome-ignore lint/suspicious/noUnknownAttribute: R3F exposes Three.js Object3D.matrixAutoUpdate on meshes.
    <mesh material={material} matrixAutoUpdate={false} ref={ring}>
      <ringGeometry args={[radius * 0.65, radius, 32]} />
    </mesh>
  );
}
