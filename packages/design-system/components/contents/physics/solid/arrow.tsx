import { type Ref, useImperativeHandle, useRef } from "react";
import { type Group, Quaternion, Vector3 } from "three";

/** Moves a vector arrow: where it starts, and the vector it draws, in scene units. */
export interface VectorArrowHandle {
  readonly set: (from: Vector3, vector: Vector3) => void;
}

/** The arrow's own up axis, which its shaft and head are built along. */
const UP = new Vector3(0, 1, 0);

/**
 * A solid arrow for a vector in a 3D lab: a round shaft and a cone head
 * that keeps its size, so a short vector still shows its direction. The
 * scene moves it every frame through `set`, without a React render. A
 * vector shorter than its head hides the arrow.
 */
export function VectorArrow({
  color,
  head = 0.05,
  ref,
  thickness = 0.008,
}: {
  readonly color: string;
  readonly head?: number;
  readonly ref?: Ref<VectorArrowHandle>;
  readonly thickness?: number;
}) {
  const group = useRef<Group>(null);
  const shaft = useRef<Group>(null);
  const tip = useRef<Group>(null);
  const turn = useRef(new Quaternion());
  const direction = useRef(new Vector3());

  useImperativeHandle(ref, () => ({
    set: (from, vector) => {
      const arrow = group.current;
      const body = shaft.current;
      const cone = tip.current;
      if (!(arrow && body && cone)) {
        return;
      }
      const length = vector.length();
      arrow.visible = length > head;
      if (!arrow.visible) {
        return;
      }
      direction.current.copy(vector).divideScalar(length);
      arrow.position.copy(from);
      arrow.quaternion.copy(
        turn.current.setFromUnitVectors(UP, direction.current)
      );
      body.scale.set(1, length - head, 1);
      body.position.set(0, (length - head) / 2, 0);
      cone.position.set(0, length - head / 2, 0);
    },
  }));

  return (
    <group ref={group} visible={false}>
      <group ref={shaft}>
        <mesh castShadow>
          <cylinderGeometry args={[thickness, thickness, 1, 12]} />
          <meshStandardMaterial color={color} roughness={0.45} />
        </mesh>
      </group>
      <group ref={tip}>
        <mesh castShadow>
          <coneGeometry args={[head * 0.42, head, 18]} />
          <meshStandardMaterial color={color} roughness={0.45} />
        </mesh>
      </group>
    </group>
  );
}
