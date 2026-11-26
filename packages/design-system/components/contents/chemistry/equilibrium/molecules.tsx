import type { DynamicSystem } from "@repo/design-system/components/contents/chemistry/equilibrium/model";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { EQUILIBRIUM_COLORS } from "@repo/design-system/lib/material/equilibrium";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";

/** Authentic 3D molecular unit inside the reactor, shaped for the selected chemical system. */
export function MoleculeCluster({
  index,
  isProduct,
  position,
  rotation,
  system,
}: {
  readonly index: number;
  readonly isProduct: boolean;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly system: DynamicSystem;
}) {
  const pos: [number, number, number] = [position[0], position[1], position[2]];
  const rot: [number, number, number] = [rotation[0], rotation[1], rotation[2]];

  if (system === "nitrogenDioxide") {
    if (isProduct) {
      // Bent reddish-brown NO2 triatomic molecule
      return (
        <group position={pos} rotation={rot}>
          <mesh castShadow>
            <sphereGeometry args={[0.0065, 12, 10]} />
            <meshPhysicalMaterial
              clearcoat={0.5}
              color={EQUILIBRIUM_COLORS.no2Brown}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[-0.0075, 0.004, 0]}>
            <sphereGeometry args={[0.0052, 10, 8]} />
            <meshPhysicalMaterial
              clearcoat={0.5}
              color={PROCESS_COLORS.acidRed}
              roughness={0.32}
            />
          </mesh>
          <mesh position={[0.0075, 0.004, 0]}>
            <sphereGeometry args={[0.0052, 10, 8]} />
            <meshPhysicalMaterial
              clearcoat={0.5}
              color={PROCESS_COLORS.acidRed}
              roughness={0.32}
            />
          </mesh>
        </group>
      );
    }
    // Pale colourless N2O4 dimer dumbbell cluster
    return (
      <group position={pos} rotation={rot}>
        <mesh position={[-0.006, 0, 0]}>
          <sphereGeometry args={[0.0065, 12, 10]} />
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={EQUILIBRIUM_COLORS.n2o4Pale}
            roughness={0.34}
          />
        </mesh>
        <mesh position={[0.006, 0, 0]}>
          <sphereGeometry args={[0.0065, 12, 10]} />
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={EQUILIBRIUM_COLORS.n2o4Pale}
            roughness={0.34}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0024, 0.0024, 0.012, 8]} />
          <meshStandardMaterial
            color={BENCH_COLORS.probeSteel}
            roughness={0.4}
          />
        </mesh>
      </group>
    );
  }

  if (system === "hydrogenIodide") {
    if (isProduct) {
      // Asymmetric HI diatomic molecule
      return (
        <group position={pos} rotation={rot}>
          <mesh castShadow position={[-0.003, 0, 0]}>
            <sphereGeometry args={[0.0072, 12, 10]} />
            <meshPhysicalMaterial
              clearcoat={0.5}
              color={EQUILIBRIUM_COLORS.product}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0.0065, 0, 0]}>
            <sphereGeometry args={[0.004, 10, 8]} />
            <meshPhysicalMaterial
              clearcoat={0.6}
              color={PROCESS_COLORS.saltBridgeWhite}
              roughness={0.25}
            />
          </mesh>
        </group>
      );
    }
    const isIodine = index % 2 === 0;
    const atomR = isIodine ? 0.0072 : 0.0045;
    const atomColor = isIodine
      ? PROCESS_COLORS.iodineViolet
      : PROCESS_COLORS.saltBridgeWhite;
    return (
      <group position={pos} rotation={rot}>
        <mesh castShadow position={[-atomR * 0.85, 0, 0]}>
          <sphereGeometry args={[atomR, 12, 10]} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={atomColor}
            roughness={0.28}
          />
        </mesh>
        <mesh castShadow position={[atomR * 0.85, 0, 0]}>
          <sphereGeometry args={[atomR, 12, 10]} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={atomColor}
            roughness={0.28}
          />
        </mesh>
      </group>
    );
  }

  // Generic A <-> B sculpted glossy spheres with equatorial metallic highlight
  return (
    <group position={pos} rotation={rot}>
      <mesh castShadow>
        <sphereGeometry args={[isProduct ? 0.0072 : 0.0082, 14, 12]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          clearcoatRoughness={0.14}
          color={
            isProduct ? EQUILIBRIUM_COLORS.product : EQUILIBRIUM_COLORS.reactant
          }
          roughness={0.24}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[isProduct ? 0.0074 : 0.0084, 0.0009, 8, 20]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
      </mesh>
    </group>
  );
}
