import { RoundedBox } from "@react-three/drei";
import { ROAD } from "@repo/design-system/components/contents/physics/kinematics/road";
import { SEDAN } from "@repo/design-system/components/contents/physics/kinematics/sedan";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { Strake } from "@repo/design-system/components/three/vessel/strake";
import { GATE_COLORS } from "@repo/design-system/lib/material/gate";
import { Array as Arr } from "effect";
import type { ReactNode, Ref } from "react";
import { useImperativeHandle, useMemo, useRef } from "react";
import type { Mesh, MeshStandardMaterial } from "three";
import { DoubleSide } from "three";

/** Where the sender stands on the open verge and the receiver on the pavement, across the road. */
const SENDER = ROAD.halfWidth + 0.55;
const RECEIVER = -(ROAD.halfWidth + 0.6);

/** The height of the beam over the road: a car's bumper. */
const BEAM = 0.52;

/** The side of a car in the left lane that faces the sender. */
const FLANK = ROAD.lane + SEDAN.width / 2;

/** How brightly the receiver's beacon burns while its beam is cut, and otherwise. */
const BEACON_GLOW = 7;
const BEACON_REST = 0.12;


/** What a simulation drives on a light gate every frame. */
export interface GateRig {
  /** Cuts the beam at the car's flank while the car stands in it, and lights the beacon. */
  readonly trip: (broken: boolean) => void;
}

/**
 * One post of a light gate: a galvanised tube on a concrete footing with a
 * hazard band, a sealed head with a hooded lens that faces across the road,
 * and the cable that feeds it.
 */
function Post({
  children,
  ground,
  z,
}: {
  /** The lens that looks across the road, and whatever lamp the head carries. */
  readonly children: ReactNode;
  /** The height of the ground the footing stands on. */
  readonly ground: number;
  readonly z: number;
}) {
  const head = BEAM - ground;
  const cable = useMemo(
    () =>
      [
        [0.02, head - 0.1, -0.03],
        [0.05, head - 0.18, -0.045],
        [0.045, 0.24, -0.04],
        [0.05, 0.12, -0.05],
        [0.12, 0.05, -0.1],
      ] as const,
    [head]
  );
  return (
    <group position={[0, ground, z]}>
      <RoundedBox
        args={[0.3, 0.1, 0.3]}
        castShadow
        position={[0, 0.05, 0]}
        radius={0.018}
        receiveShadow
        smoothness={3}
      >
        <SurfaceMaterial
          color={GATE_COLORS.footing}
          repeat={[1, 1]}
          surface="concrete"
        />
      </RoundedBox>
      <mesh castShadow position={[0, 0.1 + (head - 0.1) / 2, 0]}>
        <cylinderGeometry args={[0.024, 0.024, head - 0.1, 20]} />
        <SurfaceMaterial
          color={GATE_COLORS.steel}
          metalness={0.85}
          repeat={[1, 3]}
          roughness={0.42}
          surface="brushed"
        />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.0255, 0.0255, 0.09, 20]} />
        <SurfaceMaterial
          color={GATE_COLORS.hazard}
          repeat={[1, 1]}
          roughness={0.5}
          surface="paint"
        />
      </mesh>
      <RoundedBox
        args={[0.13, 0.17, 0.15]}
        castShadow
        position={[0, head, 0]}
        radius={0.022}
        smoothness={4}
      >
        <SurfaceMaterial
          color={GATE_COLORS.housing}
          repeat={[2, 2]}
          roughness={0.55}
          surface="plastic"
        />
      </RoundedBox>
      {Arr.map([1, -1] as const, (side) => (
        <mesh key={side} position={[side * 0.066, head, 0]}>
          <boxGeometry args={[0.004, 0.11, 0.09]} />
          <SurfaceMaterial
            color={GATE_COLORS.steel}
            metalness={0.8}
            repeat={[1, 1]}
            roughness={0.4}
            surface="brushed"
          />
        </mesh>
      ))}
      <group position={[0, head, 0]}>{children}</group>
      <Strake
        color={GATE_COLORS.cable}
        points={cable}
        radius={0.007}
        surface="rubber"
      />
    </group>
  );
}

/** A hooded lens on the face of a head that looks along `toward`, +1 or -1 in z. */
function Lens({ toward }: { readonly toward: 1 | -1 }) {
  return (
    <group
      position={[0, 0, toward * 0.075]}
      rotation={[(toward * Math.PI) / 2, 0, 0]}
    >
      <mesh castShadow position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.04, 0.036, 0.07, 28, 1, true]} />
        <SurfaceMaterial
          color={GATE_COLORS.housing}
          repeat={[2, 1]}
          roughness={0.5}
          side={DoubleSide}
          surface="plastic"
        />
      </mesh>
      <mesh position={[0, 0.004, 0]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[0.032, 28, 16]} />
        <meshPhysicalMaterial
          clearcoat={1}
          color={GATE_COLORS.lens}
          emissive={GATE_COLORS.beam}
          emissiveIntensity={1.6}
          roughness={0.08}
        />
      </mesh>
    </group>
  );
}

/**
 * A light gate across the road at `at` metres: a sender on the open verge
 * shines a beam at bumper height into a receiver on the pavement. While a
 * car in the left lane stands in the beam, the beam ends on the car's flank
 * and the receiver's beacon lights, which is the instant a timer reads. A
 * simulation drives it through `ref`, so it never re-renders mid-run.
 *
 * @param at - Where the gate stands along the road, in metres
 * @param ref - What a simulation drives each frame
 */
export function LightGate({
  at,
  ref,
}: {
  readonly at: number;
  readonly ref: Ref<GateRig>;
}) {
  const beam = useRef<Mesh>(null);
  const beacon = useRef<MeshStandardMaterial>(null);

  useImperativeHandle(ref, () => ({
    trip: (broken) => {
      const length = SENDER - (broken ? FLANK : RECEIVER) - 0.1;
      beam.current?.scale.set(1, length, 1);
      beam.current?.position.set(0, BEAM, SENDER - 0.1 - length / 2);
      if (beacon.current) {
        beacon.current.emissiveIntensity = broken ? BEACON_GLOW : BEACON_REST;
      }
    },
  }));

  return (
    <group position={[at, 0, 0]}>
      <Post ground={0} z={SENDER}>
        <Lens toward={-1} />
      </Post>
      <Post ground={ROAD.kerb} z={RECEIVER}>
        <Lens toward={1} />
        <mesh position={[0, 0.085, 0]}>
          <sphereGeometry
            args={[0.034, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial
            color={GATE_COLORS.beaconLens}
            emissive={GATE_COLORS.beaconGlow}
            emissiveIntensity={BEACON_REST}
            ref={beacon}
            roughness={0.25}
          />
        </mesh>
      </Post>
      <mesh ref={beam} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.011, 0.011, 1, 10]} />
        <meshBasicMaterial
          color={GATE_COLORS.beam}
          opacity={0.7}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  );
}
