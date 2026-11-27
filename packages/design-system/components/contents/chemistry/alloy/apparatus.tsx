import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { Turn } from "@repo/design-system/components/three/form/part";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import type { RefObject } from "react";
import { useEffect, useMemo } from "react";
import type { Group } from "three";
import { DoubleSide, ExtrudeGeometry, Shape } from "three";

export const RIG_Z = 0.04;
export const LATTICE_X = 0.055;
export const COL_STEP = 0.052;
export const ROW_Y = [0.076, 0.126, 0.176] as const;
export const SLIP_Y = 0.151;
export const HOST_RADIUS = 0.0238;
export const DEPTH_Z = [-0.025, 0.025] as const;

const ANVIL_BOLTS = [
  [-0.275, -0.088],
  [0.275, -0.088],
  [-0.275, 0.088],
  [0.275, 0.088],
] as const;

const ARROW_PROFILE = [
  [0, 0],
  [0.009, 0],
  [0.009, 0.008],
  [0.0062, 0.01],
  [0.0062, 0.056],
  [0.0155, 0.056],
  [0, 0.088],
] as const;

function createAnvilPlateGeometry() {
  const halfW = 0.305;
  const halfD = 0.112;
  const r = 0.012;
  const shape = new Shape();
  shape.moveTo(-halfW + r, -halfD);
  shape.lineTo(halfW - r, -halfD);
  shape.quadraticCurveTo(halfW, -halfD, halfW, -halfD + r);
  shape.lineTo(halfW, halfD - r);
  shape.quadraticCurveTo(halfW, halfD, halfW - r, halfD);
  shape.lineTo(-halfW + r, halfD);
  shape.quadraticCurveTo(-halfW, halfD, -halfW, halfD - r);
  shape.lineTo(-halfW, -halfD + r);
  shape.quadraticCurveTo(-halfW, -halfD, -halfW + r, -halfD);
  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    depth: 0.018,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Cast-iron metallurgical anvil baseplate and fixed lower-layer jaw clamp. */
export function ShearTestAnvil() {
  const plateGeo = useMemo(createAnvilPlateGeometry, []);
  useEffect(() => () => plateGeo.dispose(), [plateGeo]);

  return (
    <group>
      <LabBench width={2.6} />
      <group position={[0, 0, RIG_Z]}>
        {/* Heavy cast-iron bolted baseplate */}
        <mesh
          castShadow
          geometry={plateGeo}
          position={[0, 0.003, 0]}
          receiveShadow
        >
          <MetalMaterial color={CAR_COLORS.rimDark} roughness={0.62} />
        </mesh>
        {Arr.map(ANVIL_BOLTS, ([x, z]) => (
          <mesh key={`${x}-${z}`} position={[x, 0.026, z]}>
            <cylinderGeometry args={[0.007, 0.007, 0.006, 6]} />
            <MetalMaterial color={CAR_COLORS.chrome} roughness={0.25} />
          </mesh>
        ))}
        {/* Machined lower specimen bed supporting row 0 */}
        <mesh castShadow position={[LATTICE_X, 0.038, 0]} receiveShadow>
          <boxGeometry args={[0.275, 0.028, 0.118]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.54} />
        </mesh>
        {/* Raised rear fixed jaw clamp gripping rows 0 & 1 */}
        <mesh castShadow position={[LATTICE_X, 0.095, -0.068]} receiveShadow>
          <boxGeometry args={[0.275, 0.114, 0.024]} />
          <MetalMaterial color={CAR_COLORS.rimDark} roughness={0.56} />
        </mesh>
        {/* Right-side fixed abutment block bracing lower two layers against shear */}
        <mesh castShadow position={[LATTICE_X + 0.146, 0.088, 0]} receiveShadow>
          <boxGeometry args={[0.026, 0.124, 0.116]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.52} />
        </mesh>
        {/* Brass clamping bolts on rear jaw */}
        {Arr.map([-0.085, 0, 0.085] as const, (dx) => (
          <mesh
            key={dx}
            position={[LATTICE_X + dx, 0.108, -0.082]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.0075, 0.0075, 0.012, 6]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
          </mesh>
        ))}
        {/* Left hydraulic ram mounting stanchion */}
        <mesh castShadow position={[-0.228, 0.118, 0]} receiveShadow>
          <boxGeometry args={[0.072, 0.19, 0.105]} />
          <MetalMaterial color={CAR_COLORS.rimDark} roughness={0.58} />
        </mesh>
        <mesh castShadow position={[-0.228, 0.176, 0]}>
          <boxGeometry args={[0.084, 0.066, 0.112]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.48} />
        </mesh>
      </group>
    </group>
  );
}

/** Machined brass-and-chrome hydraulic shear cylinder, translating piston ram, and crimson force arrow. */
export function HydraulicShearRam({
  arrowRef,
  ramRef,
  shearForce,
}: {
  readonly arrowRef: RefObject<Group | null>;
  readonly ramRef: RefObject<Group | null>;
  readonly shearForce: number;
}) {
  const pressureNorm = Math.min(1, Math.max(0, shearForce / 100));

  return (
    <group position={[0, 0, RIG_Z]}>
      {/* Brass hydraulic cylinder housing */}
      <mesh
        castShadow
        position={[-0.178, ROW_Y[2], 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.025, 0.025, 0.088, 28]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
      </mesh>
      {/* Chrome end gland & retaining flange */}
      <mesh
        castShadow
        position={[-0.132, ROW_Y[2], 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.029, 0.029, 0.012, 28]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
      </mesh>
      {/* Top hydraulic fitting & pressure collar */}
      <mesh position={[-0.186, ROW_Y[2] + 0.032, 0]}>
        <cylinderGeometry args={[0.007, 0.008, 0.02, 16]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.26} />
      </mesh>
      <mesh position={[-0.186, ROW_Y[2] + 0.044, 0]}>
        <cylinderGeometry args={[0.011, 0.011, 0.008, 6]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
      </mesh>

      {/* Translating chrome piston rod and flat contact ram shoe */}
      <group position={[-0.084, ROW_Y[2], 0]} ref={ramRef}>
        <mesh
          castShadow
          position={[-0.036, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.011, 0.011, 0.078, 22]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.16} />
        </mesh>
        <mesh castShadow position={[0.004, 0, 0]}>
          <boxGeometry args={[0.012, 0.044, 0.084]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
        </mesh>
        <mesh position={[0.0105, 0, 0]}>
          <boxGeometry args={[0.003, 0.04, 0.08]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.34} />
        </mesh>
      </group>

      {/* Sculpted 3D crimson shear-force arrow above ram */}
      <group position={[-0.215, ROW_Y[2] + 0.078, 0]} ref={arrowRef}>
        <mesh castShadow rotation={[0, 0, -Math.PI / 2]}>
          <Turn profile={ARROW_PROFILE} />
          <meshPhysicalMaterial
            clearcoat={0.65}
            clearcoatRoughness={0.18}
            color={PROCESS_COLORS.hotRed}
            emissive={PROCESS_COLORS.hotRed}
            emissiveIntensity={0.18 + pressureNorm * 0.45}
            roughness={0.26}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Glowing translucent cyan laser slip-plane sheet slicing between row 1 and row 2. */
export function SlipPlaneSheet({ distorted }: { readonly distorted: boolean }) {
  return (
    <group position={[LATTICE_X + 0.012, SLIP_Y, RIG_Z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.295, 0.11]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.silicaBlue}
          depthWrite={false}
          emissive={PROCESS_COLORS.silicaBlue}
          emissiveIntensity={distorted ? 0.45 : 0.72}
          opacity={distorted ? 0.24 : 0.34}
          roughness={0.15}
          side={DoubleSide}
          transparent
        />
      </mesh>
      {Arr.map([-0.055, 0.055] as const, (z) => (
        <mesh key={z} position={[0, 0, z]}>
          <boxGeometry args={[0.298, 0.0024, 0.0026]} />
          <meshStandardMaterial
            color={PROCESS_COLORS.silicaBlue}
            emissive={PROCESS_COLORS.silicaBlue}
            emissiveIntensity={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}
