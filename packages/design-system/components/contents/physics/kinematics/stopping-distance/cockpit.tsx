import { PerspectiveCamera, RoundedBox } from "@react-three/drei";
import { SEDAN } from "@repo/design-system/components/contents/physics/kinematics/sedan";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";

/** The driver sits on the right, as in a right-hand-drive car, at eye height. */
const EYE = [-0.4, 1.22, 0.36] as const;

/** Where a pillar of the windscreen runs: from the dashboard's corner up to the roof. */
const PILLAR = { bottom: [0.78, 0.96, 0.74], top: [0.14, 1.43, 0.66] } as const;

/** One pillar's middle, length and turn, so a capsule lies along it. */
function pillarOf(side: 1 | -1) {
  const bottom = new Vector3(
    PILLAR.bottom[0],
    PILLAR.bottom[1],
    side * PILLAR.bottom[2]
  );
  const top = new Vector3(PILLAR.top[0], PILLAR.top[1], side * PILLAR.top[2]);
  const along = top.clone().sub(bottom);
  return {
    length: along.length(),
    middle: bottom.clone().add(top).multiplyScalar(0.5),
    turn: new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      along.normalize()
    ),
  };
}

/** Soft-touch interior trim: dark, grained and matt, so it frames the road without glare. */
function Trim({ color }: { readonly color: string }) {
  return (
    <SurfaceMaterial
      bump={0.5}
      color={color}
      repeat={[3, 3]}
      roughness={0.9}
      surface="plastic"
    />
  );
}

/**
 * The steering wheel in front of the driver: a leather rim, three spokes
 * that widen into the airbag pad, and the column it turns on.
 */
function SteeringWheel() {
  return (
    <group
      position={[0.1, 0.87, EYE[2]]}
      rotation={[0, Math.PI / 2, -0.42, "ZYX"]}
    >
      <mesh>
        <torusGeometry args={[0.185, 0.019, 16, 64]} />
        <SurfaceMaterial
          bump={0.8}
          color={CAR_COLORS.tyre}
          repeat={[12, 1]}
          roughness={0.7}
          surface="cloth"
        />
      </mesh>
      <RoundedBox args={[0.15, 0.11, 0.05]} radius={0.03} smoothness={3}>
        <Trim color={CAR_COLORS.dashboard} />
      </RoundedBox>
      {Arr.map([0, Math.PI, -Math.PI / 2] as const, (angle) => (
        <group key={angle} rotation={[0, 0, angle]}>
          <RoundedBox
            args={[0.13, 0.04, 0.022]}
            position={[0.115, 0, 0]}
            radius={0.01}
            smoothness={2}
          >
            <Trim color={CAR_COLORS.dashboard} />
          </RoundedBox>
        </group>
      ))}
      <mesh position={[0, 0, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.22, 20]} />
        <Trim color={CAR_COLORS.dashboard} />
      </mesh>
    </group>
  );
}

/**
 * The instrument binnacle behind the steering wheel: a hooded cowl over the
 * speedometer and the rev counter, each a dark dial with a lit needle.
 */
function Binnacle() {
  return (
    <group position={[0.3, 0.94, EYE[2]]}>
      <mesh rotation={[0, 0, 0.1]} scale={[0.2, 0.085, 0.24]}>
        <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Trim color={CAR_COLORS.dashboard} />
      </mesh>
      {Arr.map([0.09, -0.09], (side) => (
        <group
          key={side}
          position={[-0.13, 0.03, side]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <mesh>
            <circleGeometry args={[0.06, 32]} />
            <meshStandardMaterial color={CAR_COLORS.grille} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.001]}>
            <ringGeometry args={[0.052, 0.057, 40, 1, -0.6, Math.PI + 1.2]} />
            <meshBasicMaterial color={CAR_COLORS.headlightLens} />
          </mesh>
          <mesh position={[0.018, 0.016, 0.002]} rotation={[0, 0, 0.72]}>
            <planeGeometry args={[0.05, 0.004]} />
            <meshBasicMaterial color={CAR_COLORS.brakeLightGlow} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * What the driver sees of their own car from the right-hand seat: the
 * domed, painted bonnet ahead, a soft dashboard with the hooded instruments,
 * the steering wheel, the dark-trimmed windscreen pillars, header and roof
 * lining, and the rear-view mirror, with the camera at the driver's eyes.
 */
export function Cockpit() {
  const pillars = useMemo(() => Arr.map([1, -1] as const, pillarOf), []);
  return (
    <group>
      <PerspectiveCamera
        fov={50}
        makeDefault
        position={EYE}
        rotation={[0, -Math.PI / 2, 0]}
      />
      <mesh position={[1.5, 0.84, 0]} scale={[1.02, 0.1, 0.9]}>
        <sphereGeometry args={[1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.05}
          color={CAR_COLORS.carPaint}
          metalness={0.3}
          roughness={0.3}
        />
      </mesh>
      <RoundedBox
        args={[0.62, 0.2, SEDAN.width - 0.1]}
        position={[0.46, 0.85, 0]}
        radius={0.09}
        smoothness={4}
      >
        <Trim color={CAR_COLORS.dashboard} />
      </RoundedBox>
      <mesh position={[0.76, 0.945, 0]}>
        <boxGeometry args={[0.05, 0.02, SEDAN.width - 0.3]} />
        <meshStandardMaterial color={CAR_COLORS.grille} roughness={0.7} />
      </mesh>
      <Binnacle />
      <SteeringWheel />
      {Arr.map(pillars, ({ length, middle, turn }) => (
        <mesh key={middle.z} position={middle} quaternion={turn}>
          <capsuleGeometry args={[0.04, length, 6, 16]} />
          <Trim color={CAR_COLORS.dashboard} />
        </mesh>
      ))}
      <RoundedBox
        args={[0.16, 0.07, 1.4]}
        position={[0.13, 1.44, 0]}
        radius={0.03}
        smoothness={3}
      >
        <Trim color={CAR_COLORS.dashboard} />
      </RoundedBox>
      <mesh position={[-0.34, 1.485, 0]}>
        <boxGeometry args={[0.84, 0.02, 1.44]} />
        <Trim color={CAR_COLORS.rimDark} />
      </mesh>
      <mesh position={[0.13, 1.385, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.07, 12]} />
        <Trim color={CAR_COLORS.dashboard} />
      </mesh>
      <RoundedBox
        args={[0.03, 0.07, 0.26]}
        position={[0.11, 1.33, 0]}
        radius={0.012}
        smoothness={3}
      >
        <Trim color={CAR_COLORS.dashboard} />
      </RoundedBox>
      <mesh position={[0.094, 1.33, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.235, 0.05]} />
        <meshStandardMaterial
          color={CAR_COLORS.chrome}
          metalness={1}
          roughness={0.04}
        />
      </mesh>
    </group>
  );
}
