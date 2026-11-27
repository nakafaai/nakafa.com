import {
  CYLINDER_Z,
  SEPTUM_Y,
} from "@repo/design-system/components/contents/chemistry/lechatelier/geometry";
import { Sweep } from "@repo/design-system/components/three/form/part";
import type { Path } from "@repo/design-system/components/three/form/path";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { EQUILIBRIUM_COLORS } from "@repo/design-system/lib/material/equilibrium";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";

/** The thermal coil: four turns round the foot of the cylinder, with a lead to each terminal post. */
const COIL: Path = {
  from: [0, 0.036, 0],
  kind: "helix",
  lead: [
    [-0.076, 0.056, 0.086],
    [-0.068, 0.04, 0.072],
  ],
  phase: 2.15,
  radius: 0.08,
  tail: [
    [-0.056, 0.078, 0.076],
    [-0.054, 0.056, 0.095],
  ],
  to: [0, 0.09, 0],
  turns: 4,
};

/** Helical copper/nichrome thermal coil with ceramic terminal posts. */
export function ThermalCoil({
  activeMode,
  intensity,
}: {
  readonly activeMode: "cold" | "hot" | "neutral";
  readonly intensity: number;
}) {
  const strength = Math.abs(intensity);
  const coilVisualByMode = {
    cold: {
      color: EQUILIBRIUM_COLORS.coilCold,
      emissiveIntensity: 0.25 + strength * 0.85,
    },
    hot: {
      color: EQUILIBRIUM_COLORS.coilHot,
      emissiveIntensity: 0.35 + strength * 1.15,
    },
    neutral: {
      color: EQUILIBRIUM_COLORS.coilNeutral,
      emissiveIntensity: 0,
    },
  } as const;
  const { color, emissiveIntensity } = coilVisualByMode[activeMode];

  return (
    <group position={[0, 0, CYLINDER_Z]}>
      <mesh castShadow>
        <Sweep path={COIL} radius={0.0038} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          metalness={activeMode === "neutral" ? 0.82 : 0.45}
          roughness={0.34}
        />
      </mesh>
      {Arr.map(
        [
          [-0.076, 0.086],
          [-0.054, 0.095],
        ] as const,
        ([x, z]) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <mesh castShadow position={[0, 0.032, 0]}>
              <cylinderGeometry args={[0.0065, 0.0075, 0.036, 16]} />
              <meshPhysicalMaterial
                clearcoat={0.5}
                color={BENCH_COLORS.ptfe}
                roughness={0.38}
              />
            </mesh>
            <mesh position={[0, 0.056, 0]}>
              <cylinderGeometry args={[0.0055, 0.0055, 0.008, 6]} />
              <MetalMaterial
                color={PROCESS_COLORS.electronGold}
                roughness={0.28}
              />
            </mesh>
          </group>
        )
      )}
    </group>
  );
}

/** Side septum port and horizontal glass reagent-injection syringe. */
export function InjectionSyringe({
  active,
  intensity,
  reagentColor,
}: {
  readonly active: boolean;
  readonly intensity: number;
  readonly reagentColor: string;
}) {
  const clamped = Math.max(-1, Math.min(1, intensity));
  const stroke = active ? clamped : 0;
  const barrelStart = 0.098;
  const barrelLen = 0.118;
  const plungerX = barrelStart + 0.062 - stroke * 0.044;
  const fillLen = Math.max(0.012, plungerX - barrelStart - 0.006);
  const ticks = Arr.makeBy(7, (step) => barrelStart + 0.016 + step * 0.014);

  return (
    <group position={[0, SEPTUM_Y, CYLINDER_Z]}>
      <mesh position={[0.076, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.011, 0.013, 0.018, 20]} />
        <MetalMaterial
          color={active ? PROCESS_COLORS.electronGold : BENCH_COLORS.panSteel}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0.087, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.009, 0.009, 0.009, 18]} />
        <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.85} />
      </mesh>
      <mesh position={[0.078, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0018, 0.0018, 0.046, 12]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.18} />
      </mesh>
      <mesh
        position={[barrelStart + barrelLen / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.016, 0.016, barrelLen, 28, 1, true]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.26} />
      </mesh>
      <mesh
        position={[barrelStart - 0.004, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.005, 0.016, 0.01, 20]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.3} />
      </mesh>
      <mesh position={[barrelStart + barrelLen, 0, 0]}>
        <boxGeometry args={[0.004, 0.052, 0.036]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.34} />
      </mesh>
      <mesh
        position={[barrelStart + fillLen / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.0135, 0.0135, fillLen, 24]} />
        <LiquidMaterial color={reagentColor} opacity={active ? 0.62 : 0.3} />
      </mesh>
      {Arr.map(ticks, (x) => (
        <mesh key={x} position={[x, 0.002, 0.0164]}>
          <boxGeometry args={[0.0012, 0.008, 0.0005]} />
          <meshBasicMaterial color={INSTRUMENT_COLORS.graphite} />
        </mesh>
      ))}
      <group position={[plungerX, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0142, 0.0142, 0.011, 22]} />
          <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.82} />
        </mesh>
        <mesh position={[0.048, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0038, 0.0038, 0.092, 14]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
        </mesh>
        <mesh position={[0.096, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.016, 0.016, 0.005, 22]} />
          <MetalMaterial
            color={active ? PROCESS_COLORS.electronGold : BENCH_COLORS.panSteel}
            roughness={0.28}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Perforated golden platinum/iron honeycomb catalyst gauze suspended in chamber. */
export function CatalystGauze() {
  const rings = [0.016, 0.032, 0.048, 0.06] as const;
  const spokes = Arr.makeBy(6, (step) => (step / 6) * Math.PI);
  const pins = Arr.makeBy(3, (step) => (step / 3) * Math.PI * 2 + 0.4);
  const activeNodes = Arr.makeBy(12, (step) => ({
    angle: (step / 12) * Math.PI * 2,
    r: step % 2 === 0 ? 0.024 : 0.044,
  }));

  return (
    <group position={[0, 0.068, CYLINDER_Z]}>
      {Arr.map(rings, (radius) => (
        <mesh key={radius} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.0022, 10, 36]} />
          <meshStandardMaterial
            color={EQUILIBRIUM_COLORS.catalystMesh}
            emissive={PROCESS_COLORS.electronGold}
            emissiveIntensity={0.45}
            metalness={0.85}
            roughness={0.24}
          />
        </mesh>
      ))}
      {Arr.map(spokes, (angle) => (
        <mesh key={angle} rotation={[0, angle, 0]}>
          <boxGeometry args={[0.12, 0.0024, 0.0024]} />
          <MetalMaterial color={PROCESS_COLORS.electronGold} roughness={0.24} />
        </mesh>
      ))}
      {Arr.map(activeNodes, (node) => (
        <mesh
          key={`${node.angle}-${node.r}`}
          position={[
            Math.cos(node.angle) * node.r,
            0.002,
            Math.sin(node.angle) * node.r,
          ]}
        >
          <sphereGeometry args={[0.0032, 10, 8]} />
          <meshStandardMaterial
            color={PROCESS_COLORS.electronGold}
            emissive={PROCESS_COLORS.electronGold}
            emissiveIntensity={0.9}
          />
        </mesh>
      ))}
      {Arr.map(pins, (angle) => (
        <mesh
          key={angle}
          position={[Math.cos(angle) * 0.056, -0.022, Math.sin(angle) * 0.056]}
        >
          <cylinderGeometry args={[0.0018, 0.0018, 0.046, 10]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
        </mesh>
      ))}
    </group>
  );
}
