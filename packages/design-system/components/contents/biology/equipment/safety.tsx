import { RoundedBox } from "@react-three/drei";
import {
  PLACES,
  WALLS,
} from "@repo/design-system/components/contents/biology/equipment/places";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { CatmullRomCurve3, DoubleSide, Vector2, Vector3 } from "three";

/** The extinguisher's steel cylinder, 104 mm across, turned from its foot to the neck under the valve, in metres. */
const CYLINDER = Arr.map(
  [
    [0.001, 0],
    [0.046, 0],
    [0.052, 0.008],
    [0.052, 0.43],
    [0.046, 0.462],
    [0.026, 0.48],
    [0.015, 0.486],
    [0.015, 0.5],
  ] as const,
  ([radius, height]) => new Vector2(radius, height)
);

/** The discharge horn, a black cone 200 mm long that widens to its mouth, turned from its throat. */
const HORN = Arr.map(
  [
    [0.009, 0],
    [0.012, 0.03],
    [0.034, 0.2],
    [0.036, 0.202],
  ] as const,
  ([radius, height]) => new Vector2(radius, height)
);

/**
 * A 2 kg carbon dioxide extinguisher on its wall bracket: a red steel
 * cylinder with the black band EN 3 gives carbon dioxide, a white
 * instruction panel, a chrome valve with its carrying handle, squeeze lever
 * and safety pin, and the black horn clipped beside the body on its hose.
 */
export function Extinguisher() {
  const hose = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0.012, 0.512, 0.012),
        new Vector3(0.03, 0.53, 0.05),
        new Vector3(0.012, 0.47, 0.084),
        new Vector3(0.004, 0.43, 0.088),
      ]),
    []
  );
  const { base } = PLACES.extinguisher;
  return (
    <group>
      <group position={[WALLS.side + 0.002, base[1] + 0.47, base[2]]}>
        <mesh castShadow>
          <boxGeometry args={[0.004, 0.12, 0.06]} />
          <MetalMaterial color={LABORATORY_COLORS.carbonBand} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0.0295, 0.012, 0]}>
          <boxGeometry args={[0.055, 0.006, 0.03]} />
          <MetalMaterial color={LABORATORY_COLORS.carbonBand} roughness={0.5} />
        </mesh>
      </group>
      <group position={base}>
        <mesh castShadow receiveShadow>
          <latheGeometry args={[CYLINDER, 48]} />
          <meshPhysicalMaterial
            clearcoat={0.9}
            clearcoatRoughness={0.12}
            color={LABORATORY_COLORS.fireRed}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, 0.33, 0]}>
          <cylinderGeometry args={[0.0523, 0.0523, 0.05, 48, 1, true]} />
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={LABORATORY_COLORS.carbonBand}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, 0.19, 0]}>
          <cylinderGeometry
            args={[0.0523, 0.0523, 0.15, 24, 1, true, Math.PI / 2 - 0.55, 1.1]}
          />
          <meshStandardMaterial
            color={LABORATORY_COLORS.cross}
            roughness={0.6}
            side={DoubleSide}
          />
        </mesh>
        <mesh castShadow position={[0, 0.515, 0]}>
          <cylinderGeometry args={[0.017, 0.019, 0.03, 24]} />
          <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.2} />
        </mesh>
        <mesh castShadow position={[0.04, 0.53, 0]} rotation={[0, 0, -0.06]}>
          <boxGeometry args={[0.1, 0.008, 0.022]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.carbonBand}
            roughness={0.5}
          />
        </mesh>
        <mesh castShadow position={[0.04, 0.565, 0]} rotation={[0, 0, 0.22]}>
          <boxGeometry args={[0.1, 0.008, 0.022]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.carbonBand}
            roughness={0.5}
          />
        </mesh>
        <mesh position={[-0.005, 0.548, 0.02]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.009, 0.0016, 8, 20]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.capYellow}
            roughness={0.5}
          />
        </mesh>
        <mesh castShadow>
          <tubeGeometry args={[hose, 24, 0.006, 10, false]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.carbonBand}
            roughness={0.6}
          />
        </mesh>
        <mesh
          castShadow
          position={[0.004, 0.43, 0.088]}
          rotation={[Math.PI, 0, 0]}
        >
          <latheGeometry args={[HORN, 32]} />
          <meshPhysicalMaterial
            clearcoat={0.3}
            color={LABORATORY_COLORS.carbonBand}
            roughness={0.5}
            side={DoubleSide}
          />
        </mesh>
      </group>
      <WallSign height={base[1] + 0.82} z={base[2]}>
        <mesh position={[0, -0.005, 0]} scale={[1, 1, 0.08]}>
          <capsuleGeometry args={[0.016, 0.06, 6, 16]} />
          <meshBasicMaterial color={LABORATORY_COLORS.cross} />
        </mesh>
        <mesh position={[0.008, 0.052, 0]}>
          <boxGeometry args={[0.03, 0.01, 0.001]} />
          <meshBasicMaterial color={LABORATORY_COLORS.cross} />
        </mesh>
        <mesh position={[-0.03, 0.01, 0]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.008, 0.06, 0.001]} />
          <meshBasicMaterial color={LABORATORY_COLORS.cross} />
        </mesh>
      </WallSign>
    </group>
  );
}

/**
 * A square fire-equipment sign on the side wall, 150 mm across, its symbol
 * drawn in white on the red plate ISO 7010 gives fire equipment.
 */
function WallSign({
  children,
  height,
  z,
}: {
  readonly children: ReactNode;
  readonly height: number;
  readonly z: number;
}) {
  return (
    <group
      position={[WALLS.side + 0.002, height, z]}
      rotation={[0, Math.PI / 2, 0]}
    >
      <mesh receiveShadow>
        <boxGeometry args={[0.15, 0.15, 0.003]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.fireRed}
          roughness={0.45}
        />
      </mesh>
      <group position={[0, 0, 0.002]}>{children}</group>
    </group>
  );
}

/**
 * A fire blanket in its red rigid case on the side wall, the two black tapes
 * hanging from the bottom: pulling them draws the blanket out in one move.
 */
export function FireBlanket() {
  const { base, size } = PLACES.fireBlanket;
  return (
    <group position={base}>
      <RoundedBox
        args={[size[0], size[1], size[2]]}
        castShadow
        position={[0, size[1] / 2, 0]}
        radius={0.006}
        receiveShadow
      >
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={LABORATORY_COLORS.fireRed}
          roughness={0.4}
        />
      </RoundedBox>
      <mesh
        position={[size[0] / 2 + 0.0005, size[1] * 0.62, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[size[2] - 0.03, 0.07]} />
        <meshStandardMaterial color={LABORATORY_COLORS.cross} roughness={0.6} />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <group key={side} position={[0.012, 0, side * 0.045]}>
          <mesh castShadow position={[0, -0.04, 0]}>
            <boxGeometry args={[0.0015, 0.08, 0.018]} />
            <meshStandardMaterial
              color={LABORATORY_COLORS.strap}
              roughness={0.8}
            />
          </mesh>
          <mesh castShadow position={[0.002, -0.092, 0]}>
            <boxGeometry args={[0.004, 0.026, 0.026]} />
            <meshStandardMaterial
              color={LABORATORY_COLORS.strap}
              roughness={0.6}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A green first aid box on the side wall with the white cross of ISO 7010 E003 on its door. */
export function FirstAid() {
  const { base, size } = PLACES.firstAid;
  return (
    <group position={base}>
      <RoundedBox
        args={[size[0], size[1], size[2]]}
        castShadow
        position={[0, size[1] / 2, 0]}
        radius={0.008}
        receiveShadow
      >
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={LABORATORY_COLORS.safeGreen}
          roughness={0.4}
        />
      </RoundedBox>
      <group position={[size[0] / 2 + 0.001, size[1] / 2, 0]}>
        <mesh>
          <boxGeometry args={[0.002, 0.11, 0.035]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.cross}
            roughness={0.5}
          />
        </mesh>
        <mesh>
          <boxGeometry args={[0.002, 0.035, 0.11]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.cross}
            roughness={0.5}
          />
        </mesh>
        <mesh position={[0.003, 0, size[2] / 2 - 0.03]}>
          <boxGeometry args={[0.006, 0.03, 0.012]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.cross}
            roughness={0.5}
          />
        </mesh>
      </group>
    </group>
  );
}
