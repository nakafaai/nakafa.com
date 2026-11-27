import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { Sweep } from "@repo/design-system/components/three/form/part";
import type { Path } from "@repo/design-system/components/three/form/path";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import type { RefObject } from "react";
import type { Group } from "three";

export const RIG_Z = 0.03;
export const COMPRESSOR_X = -0.31;
export const CONVERTER_X = 0;
export const CONDENSER_X = 0.31;

/** The feed line from the compressor's head to the converter's inlet. */
export const FEED: Path = [
  [COMPRESSOR_X, 0.315, RIG_Z],
  [COMPRESSOR_X + 0.03, 0.352, RIG_Z],
  [-0.155, 0.352, RIG_Z],
  [-0.088, 0.318, RIG_Z],
];

/** The synthesis line from the converter's outlet up to the condenser. */
export const SYNTHESIS: Path = [
  [0.088, 0.132, RIG_Z],
  [0.155, 0.132, RIG_Z],
  [0.185, 0.285, RIG_Z],
  [CONDENSER_X - 0.075, 0.305, RIG_Z],
];

/** The recycle loop from the condenser's top back over the rig to the compressor. */
export const RECYCLE: Path = [
  [CONDENSER_X, 0.388, RIG_Z],
  [CONDENSER_X, 0.452, RIG_Z],
  [0.18, 0.472, RIG_Z],
  [0, 0.475, RIG_Z],
  [-0.18, 0.472, RIG_Z],
  [COMPRESSOR_X, 0.448, RIG_Z - 0.01],
  [COMPRESSOR_X, 0.33, RIG_Z - 0.025],
];

/** Bolted dark steel skid baseplate sitting directly on the epoxy benchtop. */
export function PilotSkid() {
  const bolts = [
    [-0.4, -0.095],
    [0.4, -0.095],
    [-0.4, 0.095],
    [0.4, 0.095],
  ] as const;
  return (
    <group>
      <LabBench width={2.8} />
      <mesh castShadow position={[0, 0.007, RIG_Z]} receiveShadow>
        <boxGeometry args={[0.88, 0.014, 0.24]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.62} />
      </mesh>
      {Arr.map(bolts, ([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.017, RIG_Z + z]}>
          <cylinderGeometry args={[0.006, 0.006, 0.006, 6]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.28} />
        </mesh>
      ))}
    </group>
  );
}

/** Reciprocating gas compressor with cooling fins, moving piston rod, flywheel, and pressure gauge. */
export function CompressorUnit({
  flywheelRef,
  pistonRef,
  pressureAtm,
}: {
  readonly flywheelRef: RefObject<Group | null>;
  readonly pistonRef: RefObject<Group | null>;
  readonly pressureAtm: number;
}) {
  const normP = Math.max(0, Math.min(1, (pressureAtm - 50) / 300));
  const needleAngle = 2.15 - normP * 4.3;
  const fins = Arr.makeBy(6, (step) => 0.175 + step * 0.018);
  const ticks = Arr.makeBy(11, (step) => 2.15 - (step / 10) * 4.3);

  return (
    <group position={[COMPRESSOR_X, 0.014, RIG_Z]}>
      {Arr.map(
        [
          [-0.098, -0.045, PROCESS_COLORS.catalystTeal],
          [-0.098, 0.045, PROCESS_COLORS.alloySteel],
        ] as const,
        ([x, z, color]) => (
          <group key={z} position={[x, 0, z]}>
            <mesh castShadow position={[0, 0.09, 0]}>
              <cylinderGeometry args={[0.022, 0.022, 0.18, 22]} />
              <MetalMaterial color={color} roughness={0.34} />
            </mesh>
            <mesh castShadow position={[0, 0.185, 0]}>
              <sphereGeometry
                args={[0.022, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
              />
              <MetalMaterial color={color} roughness={0.34} />
            </mesh>
            <mesh position={[0, 0.218, 0]}>
              <cylinderGeometry args={[0.005, 0.005, 0.024, 12]} />
              <MetalMaterial
                color={PROCESS_COLORS.electronGold}
                roughness={0.28}
              />
            </mesh>
            <mesh position={[0, 0.23, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.012, 0.0025, 8, 20]} />
              <MetalMaterial color={PROCESS_COLORS.hotRed} roughness={0.38} />
            </mesh>
            <mesh position={[0.036, 0.11, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.006, 0.006, 0.068, 12]} />
              <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
            </mesh>
          </group>
        )
      )}
      <mesh castShadow position={[0, 0.068, 0]} receiveShadow>
        <boxGeometry args={[0.128, 0.136, 0.122]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.55} />
      </mesh>
      <group position={[-0.072, 0.068, 0]} ref={flywheelRef}>
        <mesh castShadow rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.048, 0.008, 12, 32]} />
          <MetalMaterial color={PROCESS_COLORS.ironDark} roughness={0.44} />
        </mesh>
        {Arr.map([0, Math.PI / 3, (Math.PI * 2) / 3] as const, (ang) => (
          <mesh key={ang} rotation={[ang, 0, 0]}>
            <boxGeometry args={[0.008, 0.088, 0.009]} />
            <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.34} />
          </mesh>
        ))}
      </group>
      <mesh castShadow position={[0, 0.222, 0]}>
        <cylinderGeometry args={[0.044, 0.048, 0.15, 28]} />
        <MetalMaterial color={PROCESS_COLORS.alloySteel} roughness={0.34} />
      </mesh>
      {Arr.map(fins, (y) => (
        <mesh castShadow key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.058, 0.058, 0.0045, 28]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.302, 0]}>
        <cylinderGeometry args={[0.052, 0.052, 0.018, 28]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.46} />
      </mesh>
      <group position={[0.046, 0.155, 0.036]} ref={pistonRef}>
        <mesh castShadow>
          <cylinderGeometry args={[0.007, 0.007, 0.072, 16]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.18} />
        </mesh>
        <mesh position={[0, -0.025, 0]}>
          <boxGeometry args={[0.024, 0.016, 0.02]} />
          <MetalMaterial color={PROCESS_COLORS.electronGold} roughness={0.3} />
        </mesh>
      </group>
      <group position={[0, 0.23, 0.072]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.018, 32]} />
          <MetalMaterial color={PROCESS_COLORS.electronGold} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0, 0.0095]}>
          <torusGeometry args={[0.044, 0.0045, 12, 36]} />
          <MetalMaterial color={PROCESS_COLORS.electronGold} roughness={0.24} />
        </mesh>
        <mesh position={[0, 0, 0.0096]}>
          <circleGeometry args={[0.04, 32]} />
          <meshStandardMaterial
            color={BENCH_COLORS.ceramicTile}
            roughness={0.45}
          />
        </mesh>
        <mesh position={[0, 0, 0.0102]} rotation={[0, 0, -0.8]}>
          <ringGeometry args={[0.029, 0.035, 16, 1, 0, 1.3]} />
          <meshBasicMaterial color={PROCESS_COLORS.hotRed} />
        </mesh>
        {Arr.map(ticks, (ang) => (
          <mesh
            key={ang}
            position={[Math.sin(-ang) * 0.032, Math.cos(-ang) * 0.032, 0.0106]}
            rotation={[0, 0, ang]}
          >
            <boxGeometry args={[0.0018, 0.006, 0.0005]} />
            <meshBasicMaterial color={INSTRUMENT_COLORS.graphite} />
          </mesh>
        ))}
        <group position={[0, 0, 0.0115]} rotation={[0, 0, needleAngle]}>
          <mesh position={[0, 0.013, 0]}>
            <boxGeometry args={[0.0034, 0.03, 0.0012]} />
            <meshStandardMaterial
              color={PROCESS_COLORS.hotRed}
              emissive={PROCESS_COLORS.hotRed}
              emissiveIntensity={0.25 + normP * 0.6}
            />
          </mesh>
        </group>
        <mesh position={[0, 0, 0.013]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0055, 0.0055, 0.004, 16]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.0136]}>
          <circleGeometry args={[0.041, 32]} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.18} />
        </mesh>
      </group>
    </group>
  );
}

/** Flanged stainless interconnecting pipes and overhead recycle loop with brass valve wheel. */
export function ProcessPiping() {
  return (
    <group>
      <mesh castShadow>
        <Sweep path={FEED} radius={0.011} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.26} />
      </mesh>
      <mesh castShadow>
        <Sweep path={SYNTHESIS} radius={0.011} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.26} />
      </mesh>
      <mesh castShadow>
        <Sweep path={RECYCLE} radius={0.0115} />
        <MetalMaterial color={PROCESS_COLORS.alloySteel} roughness={0.26} />
      </mesh>
      {Arr.map([-0.16, 0.16] as const, (x) => (
        <mesh
          key={x}
          position={[x, 0.473, RIG_Z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.019, 0.019, 0.01, 20]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.44} />
        </mesh>
      ))}
      <group position={[0, 0.475, RIG_Z]}>
        <mesh>
          <cylinderGeometry args={[0.016, 0.016, 0.028, 18]} />
          <MetalMaterial color={PROCESS_COLORS.electronGold} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.028, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.026, 12]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.02, 0.0036, 10, 24]} />
          <MetalMaterial color={PROCESS_COLORS.electronGold} roughness={0.26} />
        </mesh>
      </group>
    </group>
  );
}
