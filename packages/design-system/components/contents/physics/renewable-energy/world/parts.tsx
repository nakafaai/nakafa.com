import { useFrame } from "@react-three/fiber";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { type ReactNode, useMemo, useRef } from "react";
import { type Mesh, Quaternion, Vector3 } from "three";

/**
 * The parts the renewable-energy scenes share: straight pipes and rods,
 * parcels of water or steam moving along a pipe, and puffs of steam rising
 * from a stack. Every part stands in the stage's light; none draws a backdrop
 * or a light of its own.
 */

/** A point in the scene, in scene units. */
type Spot = readonly [number, number, number];

/** The time a scene has played, in seconds, held while the card is paused. */
function useSceneTime() {
  const playing = useVisualScene((card) => card.playing, false);
  const time = useRef(0);
  useFrame((_, delta) => {
    if (playing) {
      time.current += Math.min(delta, 0.1);
    }
  });
  return time;
}

/** The middle, turn and length of a straight piece between two points. */
function span(from: Spot, to: Spot) {
  const start = new Vector3(...from);
  const end = new Vector3(...to);
  const direction = end.clone().sub(start);
  return {
    length: direction.length(),
    middle: start.clone().add(end).multiplyScalar(0.5),
    turn: new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      direction.normalize()
    ),
  };
}

/** A straight pipe, rod or cable from one point to another; its children are its material. */
export function Pipe({
  children,
  from,
  radius,
  to,
}: {
  readonly children: ReactNode;
  readonly from: Spot;
  readonly radius: number;
  readonly to: Spot;
}) {
  const piece = useMemo(() => span(from, to), [from, to]);
  return (
    <mesh
      castShadow
      position={piece.middle}
      quaternion={piece.turn}
      receiveShadow
    >
      <cylinderGeometry args={[radius, radius, piece.length, 20]} />
      {children}
    </mesh>
  );
}

/**
 * Parcels moving along a straight path at `pace` path lengths a second, as
 * water racing down a penstock or steam running to a turbine.
 */
export function Parcels({
  color,
  count,
  from,
  pace,
  size,
  to,
}: {
  readonly color: string;
  readonly count: number;
  readonly from: Spot;
  readonly pace: number;
  readonly size: number;
  readonly to: Spot;
}) {
  const time = useSceneTime();
  const meshes = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    Arr.forEach(meshes.current, (mesh, index) => {
      if (!mesh) {
        return;
      }
      const along = (index / count + time.current * pace) % 1;
      mesh.position.set(
        from[0] + (to[0] - from[0]) * along,
        from[1] + (to[1] - from[1]) * along,
        from[2] + (to[2] - from[2]) * along
      );
    });
  });
  return (
    <group>
      {Arr.map(Arr.range(0, count - 1), (index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            meshes.current[index] = mesh;
          }}
        >
          <sphereGeometry args={[size, 12, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Puffs of steam rising from `at`, as many and as big as `amount`, from 0 to 1. */
export function Puffs({
  amount,
  at,
  rise,
  size,
}: {
  readonly amount: number;
  readonly at: Spot;
  readonly rise: number;
  readonly size: number;
}) {
  const time = useSceneTime();
  const meshes = useRef<(Mesh | null)[]>([]);
  const count = 7;
  useFrame(() => {
    Arr.forEach(meshes.current, (mesh, index) => {
      if (!mesh) {
        return;
      }
      const age = (time.current * 0.18 + index / count) % 1;
      const grow = size * (0.4 + age * 1.6) * Math.max(amount, 0.05);
      mesh.position.set(
        at[0] + Math.sin(index * 2.3 + time.current * 0.4) * size * 0.4,
        at[1] + age * rise,
        at[2] + Math.cos(index * 1.7) * size * 0.3
      );
      mesh.scale.setScalar(grow);
      const material = mesh.material;
      if (!Arr.isArray(material) && "opacity" in material) {
        material.opacity = 0.55 * (1 - age) * Math.min(1, amount * 2);
      }
    });
  });
  return (
    <group>
      {Arr.map(Arr.range(0, count - 1), (index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            meshes.current[index] = mesh;
          }}
        >
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial
            color={MATERIAL.cloud}
            depthWrite={false}
            roughness={1}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}
