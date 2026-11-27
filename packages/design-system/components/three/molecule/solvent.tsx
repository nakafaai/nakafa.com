import { useFrame } from "@react-three/fiber";
import { ELEMENTS } from "@repo/design-system/components/three/molecule/element";
import {
  homesOf,
  WATER,
  wanderInto,
} from "@repo/design-system/components/three/molecule/water";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr } from "effect";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Color, Matrix4, Quaternion, Vector3 } from "three";

/** How far a water molecule wanders from its home on each axis, in angstrom. */
const STRIDE = 2.4;

/** How fast a water molecule tumbles, in radians a second. */
const TUMBLE = 0.5;

/**
 * The water a molecule lives in: `count` real water molecules, each an oxygen
 * and two hydrogens at water's bond length and angle, scattered through the
 * shell between `inner` and `outer` angstrom from the subject at the middle.
 * While `playing` they drift and tumble with thermal motion; the whole cloud
 * is one instanced mesh and its motion allocates nothing.
 */
export function Solvent({
  count,
  inner,
  outer,
  playing,
}: {
  readonly count: number;
  readonly inner: number;
  readonly outer: number;
  readonly playing: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const clock = useRef(0);
  const homes = useMemo(
    () => homesOf(count, inner, outer),
    [count, inner, outer]
  );
  const scratch = useMemo(
    () => ({
      axis: new Vector3(),
      matrix: new Matrix4(),
      offset: new Vector3(),
      place: new Vector3(),
      places: new Float32Array(homes.length),
      size: new Vector3(),
      turn: new Quaternion(),
    }),
    [homes]
  );

  const lay = (time: number) => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    wanderInto(scratch.places, homes, time, STRIDE);
    for (let index = 0; index < count; index += 1) {
      scratch.axis
        .set(
          Math.sin(index * 1.3),
          Math.cos(index * 2.1),
          Math.sin(index * 3.7)
        )
        .normalize();
      scratch.turn.setFromAxisAngle(scratch.axis, index * 1.9 + time * TUMBLE);
      Arr.forEach(WATER, ([element, x, y, z], atom) => {
        scratch.offset.set(x, y, z).applyQuaternion(scratch.turn);
        scratch.place
          .set(
            Number(scratch.places[index * 3]),
            Number(scratch.places[index * 3 + 1]),
            Number(scratch.places[index * 3 + 2])
          )
          .add(scratch.offset);
        scratch.matrix.compose(
          scratch.place,
          scratch.turn,
          scratch.size.setScalar(ELEMENTS[element].reach * 0.62)
        );
        target.setMatrixAt(index * WATER.length + atom, scratch.matrix);
      });
    }
    target.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const color = new Color();
    Arr.forEach(Arr.range(0, count - 1), (index) => {
      Arr.forEach(WATER, ([element], atom) => {
        target.setColorAt(
          index * WATER.length + atom,
          color.set(ELEMENTS[element].color)
        );
      });
    });
    if (target.instanceColor !== null) {
      target.instanceColor.needsUpdate = true;
    }
    lay(clock.current);
    target.computeBoundingSphere();
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current += Math.min(delta, 0.1);
    lay(clock.current);
  });

  return (
    <instancedMesh
      args={[undefined, undefined, count * WATER.length]}
      key={count}
      ref={mesh}
    >
      <sphereGeometry args={[1, 14, 10]} />
      <meshPhysicalMaterial
        clearcoat={0.6}
        clearcoatRoughness={0.25}
        color={getColor("WHITE")}
        opacity={0.82}
        roughness={0.35}
        transparent
      />
    </instancedMesh>
  );
}
