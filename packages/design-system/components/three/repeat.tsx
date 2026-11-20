import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";
import type { InstancedMesh } from "three";
import { Object3D } from "three";

/** Three numbers along x, y and z. */
const TripleSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);

/** One copy of a repeated part: where it stands, how it turns, and how it scales. */
const PlacementSchema = Schema.Struct({
  position: TripleSchema,
  rotation: Schema.optionalKey(TripleSchema),
  scale: Schema.optionalKey(TripleSchema),
});
export type Placement = typeof PlacementSchema.Type;

/** The object every placement is composed through, reused so placing allocates nothing. */
const PLACER = new Object3D();

/**
 * Draws one part many times in a single draw call: tyres along a hull,
 * stanchions along a rail, panes in a row of windows. The children are the
 * part's geometry and material; every placement is written into the
 * instance matrices once, when the placements change, never on a frame.
 *
 * @param placements - Where each copy stands
 * @param shadows - Whether the copies cast and receive shadows
 */
export function Repeat({
  children,
  placements,
  shadows = true,
}: {
  readonly children: ReactNode;
  readonly placements: readonly Placement[];
  readonly shadows?: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (instanced === null) {
      return;
    }
    Arr.forEach(placements, (placement, index) => {
      PLACER.position.set(...placement.position);
      PLACER.rotation.set(...(placement.rotation ?? [0, 0, 0]));
      PLACER.scale.set(...(placement.scale ?? [1, 1, 1]));
      PLACER.updateMatrix();
      instanced.setMatrixAt(index, PLACER.matrix);
    });
    instanced.count = placements.length;
    instanced.instanceMatrix.needsUpdate = true;
    // The geometry may attach after this runs, so the renderer measures the copies' bounds when it next culls them.
    instanced.boundingSphere = null;
    instanced.boundingBox = null;
  }, [placements]);

  return (
    <instancedMesh
      args={[undefined, undefined, placements.length]}
      castShadow={shadows}
      key={placements.length}
      receiveShadow={shadows}
      ref={mesh}
    >
      {children}
    </instancedMesh>
  );
}
