import {
  SPIKES,
  spikeAnchor,
} from "@repo/design-system/components/contents/biology/virus/binding";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";

/** The up direction a spike is modelled along before it is turned outward. */
const UP = new Vector3(0, 1, 0);

/**
 * A SARS-CoV-2 virion about 100 nm across, drawn with a radius of 1 for
 * 50 nm: a lipid envelope and 24 spikes about 20 nm long, each a stalk with a
 * club-shaped trimer head. A spike in `bound` carries a Y-shaped antibody
 * about 15 nm across on its head.
 */
export function Virion({
  bound = [],
}: {
  readonly bound?: readonly boolean[];
}) {
  const turns = useMemo(
    () =>
      Arr.map(Arr.range(0, SPIKES - 1), (index) => {
        const [x, y, z] = spikeAnchor(index, SPIKES);
        const direction = new Vector3(x, y, z);
        return {
          index,
          position: [x, y, z] as const,
          quaternion: new Quaternion().setFromUnitVectors(UP, direction),
        };
      }),
    []
  );

  return (
    <group>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[1, 48, 32]} />
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={MATERIAL.membrane}
          roughness={0.6}
          sheen={0.7}
        />
      </mesh>
      {Arr.map(turns, ({ index, position, quaternion }) => (
        <group key={index} position={position} quaternion={quaternion}>
          <mesh castShadow position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.035, 0.05, 0.24, 8]} />
            <meshStandardMaterial color={MATERIAL.spike} roughness={0.6} />
          </mesh>
          <mesh castShadow position={[0, 0.32, 0]} scale={[1, 1.3, 1]}>
            <sphereGeometry args={[0.1, 16, 12]} />
            <meshStandardMaterial color={MATERIAL.spike} roughness={0.55} />
          </mesh>
          {bound[index] === true && <Antibody />}
        </group>
      ))}
    </group>
  );
}

/**
 * An IgG antibody bound on a spike's head: its two arms grip the head and its
 * stem points away, a Y about 15 nm across.
 */
function Antibody() {
  return (
    <group position={[0, 0.42, 0]}>
      <mesh castShadow position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.045, 0.2, 4, 8]} />
        <meshPhysicalMaterial clearcoat={0.5} color={MATERIAL.antibody} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[-0.09, 0.02, 0]} rotation={[0, 0, -0.75]}>
        <capsuleGeometry args={[0.04, 0.17, 4, 8]} />
        <meshPhysicalMaterial clearcoat={0.5} color={MATERIAL.antibody} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[0.09, 0.02, 0]} rotation={[0, 0, 0.75]}>
        <capsuleGeometry args={[0.04, 0.17, 4, 8]} />
        <meshPhysicalMaterial clearcoat={0.5} color={MATERIAL.antibody} roughness={0.35} />
      </mesh>
    </group>
  );
}
