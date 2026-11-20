import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";
import type { InstancedMesh } from "three";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";

/** Three coordinates: a position, a direction, a rotation, or a stretch. */
const TripleSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);

/**
 * One copy of an instanced shape: where it stands, how it stretches, and how
 * it turns, either by Euler angles or by pointing its own y axis `up` along
 * a direction and spinning `spin` radians about it.
 */
const PlacementSchema = Schema.Struct({
  position: TripleSchema,
  rotation: Schema.optionalKey(TripleSchema),
  scale: Schema.optionalKey(TripleSchema),
  spin: Schema.optionalKey(Schema.Finite),
  up: Schema.optionalKey(TripleSchema),
});
export type Placement = typeof PlacementSchema.Type;

/** The y axis a shape is modelled along. */
const UP = new Vector3(0, 1, 0);

/** The matrix that puts a shape at `placement`. */
function placementMatrix(placement: Placement) {
  const turn = new Quaternion();
  if (placement.up === undefined) {
    turn.setFromEuler(new Euler(...(placement.rotation ?? [0, 0, 0])));
  } else {
    turn
      .setFromUnitVectors(UP, new Vector3(...placement.up).normalize())
      .multiply(new Quaternion().setFromAxisAngle(UP, placement.spin ?? 0));
  }
  return new Matrix4().compose(
    new Vector3(...placement.position),
    turn,
    new Vector3(...(placement.scale ?? [1, 1, 1]))
  );
}

/**
 * Draws many copies of one shape at their placements as a single instanced
 * mesh, one draw call however many there are.
 */
export function Instances({
  children,
  placements,
}: {
  readonly children: ReactNode;
  readonly placements: readonly Placement[];
}) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    Arr.forEach(placements, (placement, index) => {
      target.setMatrixAt(index, placementMatrix(placement));
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  });
  return (
    <instancedMesh
      args={[undefined, undefined, placements.length]}
      castShadow
      receiveShadow
      ref={mesh}
    >
      {children}
    </instancedMesh>
  );
}
