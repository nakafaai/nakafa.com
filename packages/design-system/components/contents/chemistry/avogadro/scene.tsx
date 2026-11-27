import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  CYL_FLOOR,
  CYL_INNER_R,
  GasCylinder,
  PistonAssembly,
  RetortStand,
  RIG_Z,
} from "@repo/design-system/components/contents/chemistry/avogadro/apparatus";
import type { GasCondition } from "@repo/design-system/components/contents/chemistry/avogadro/model";
import { evaluateAvogadroGas } from "@repo/design-system/components/contents/chemistry/avogadro/model";
import {
  GlassThermometer,
  THERM_X,
} from "@repo/design-system/components/contents/chemistry/avogadro/thermometer";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";

const MAX_MOLECULES = 24;

function AvogadroCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 0.36, 1.24] : [0, 0.29, 0.94]}
      cameraTarget={[0.01, 0.21, 0.02]}
      fov={37}
      maxDistance={2.4}
      minDistance={0.4}
    />
  );
}

/** Deterministic triangle-wave bounce in [0, 1] for analytical reflection without drift. */
function triangleWave(value: number): number {
  const wrapped = ((value % 2) + 2) % 2;
  return wrapped <= 1 ? wrapped : 2 - wrapped;
}

function createMoleculeSeeds() {
  return Arr.makeBy(MAX_MOLECULES, (idx) => {
    const angle = idx * 2.399_96;
    const radFrac = 0.22 + ((idx * 17) % 10) * 0.072;
    return {
      id: `m-${idx}`,
      ox: Math.cos(angle) * radFrac,
      oy: ((idx * 31 + 7) % 100) / 100,
      oz: Math.sin(angle) * radFrac,
      rx: idx * 0.7,
      ry: idx * 1.1,
      vx: 0.72 + ((idx * 13) % 7) * 0.14,
      vy: 0.85 + ((idx * 19) % 7) * 0.16,
      vz: 0.68 + ((idx * 11) % 7) * 0.15,
    };
  });
}

function moleculeCoords(
  seed: {
    readonly ox: number;
    readonly oy: number;
    readonly oz: number;
    readonly vx: number;
    readonly vy: number;
    readonly vz: number;
  },
  phase: number,
  pistonY: number
): readonly [number, number, number] {
  const maxR = CYL_INNER_R - 0.016;
  const minY = CYL_FLOOR + 0.012;
  const maxY = Math.max(minY + 0.012, pistonY - 0.02);
  const rawX =
    (triangleWave((seed.ox + 1) * 0.5 + phase * seed.vx) * 2 - 1) * maxR;
  const rawZ =
    (triangleWave((seed.oz + 1) * 0.5 + phase * seed.vz) * 2 - 1) * maxR;
  const dist = Math.hypot(rawX, rawZ);
  const clamp = dist > maxR ? maxR / dist : 1;
  const y = minY + triangleWave(seed.oy + phase * seed.vy) * (maxY - minY);
  return [rawX * clamp, y, RIG_Z + rawZ * clamp] as const;
}

export function AvogadroGasScene({
  condition,
  moles,
  parts,
}: {
  readonly condition: GasCondition;
  readonly moles: number;
  readonly parts: Readonly<
    Record<
      "cylinder" | "gasParticles" | "piston" | "thermometer" | "volumeScale",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const labelInk = useLabelInk();

  const moleculeRefs = useRef<(Group | null)[]>([]);
  const phaseRef = useRef(0);

  const reading = evaluateAvogadroGas(condition, moles);
  const pistonY = Math.min(
    0.278,
    Math.max(0.088, 0.068 + (reading.volumeDm3 / 75) * 0.215)
  );
  const moleculeCount = Math.min(
    MAX_MOLECULES,
    Math.max(6, Math.round(moles * 8))
  );
  const seeds = useMemo(createMoleculeSeeds, []);
  const activeSeeds = useMemo(
    () => Arr.take(seeds, moleculeCount),
    [moleculeCount, seeds]
  );

  const syncMolecules = (phase: number) => {
    for (let i = 0; i < activeSeeds.length; i += 1) {
      const group = moleculeRefs.current[i];
      const seed = activeSeeds[i];
      if (group !== null && group !== undefined && seed !== undefined) {
        const [x, y, z] = moleculeCoords(seed, phase, pistonY);
        group.position.set(x, y, z);
        group.rotation.set(seed.rx + phase * 3.1, seed.ry + phase * 2.4, 0);
      }
    }
  };

  useEffect(() => {
    syncMolecules(phaseRef.current);
  });

  useVisualStop(() => {
    phaseRef.current = 0;
    syncMolecules(0);
    invalidate();
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    const speed = condition === "rtp" ? 1.55 : 0.92;
    phaseRef.current += simulationStep(delta) * speed;
    syncMolecules(phaseRef.current);
  });

  const moleculeColor =
    condition === "rtp" ? PROCESS_COLORS.ammoniaCyan : PROCESS_COLORS.coldBlue;

  return (
    <group>
      <SimulationTicker running={playing} />
      <AvogadroCamera />
      <RetortStand />
      <GasCylinder />
      <PistonAssembly pistonY={pistonY} />
      <GlassThermometer condition={condition} />

      {/* 3D diatomic gas molecules bouncing beneath the piston */}
      <group>
        {Arr.map(activeSeeds, (seed, index) => {
          const initPos = moleculeCoords(seed, 0, pistonY);
          return (
            <group
              key={seed.id}
              position={initPos}
              ref={(el) => {
                moleculeRefs.current[index] = el;
              }}
              rotation={[seed.rx, seed.ry, 0]}
            >
              <mesh position={[-0.0046, 0, 0]}>
                <sphereGeometry args={[0.0064, 14, 12]} />
                <meshPhysicalMaterial
                  clearcoat={0.65}
                  clearcoatRoughness={0.14}
                  color={moleculeColor}
                  emissive={moleculeColor}
                  emissiveIntensity={0.22}
                  roughness={0.22}
                />
              </mesh>
              <mesh position={[0.0046, 0, 0]}>
                <sphereGeometry args={[0.0064, 14, 12]} />
                <meshPhysicalMaterial
                  clearcoat={0.65}
                  clearcoatRoughness={0.14}
                  color={moleculeColor}
                  emissive={moleculeColor}
                  emissiveIntensity={0.22}
                  roughness={0.22}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Adaptive labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0, pistonY + 0.168, RIG_Z]}
      >
        <span>{parts.piston}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={labelInk}
        fontSize="compact"
        position={[-0.085, 0.33, RIG_Z + 0.03]}
      >
        <span>{parts.cylinder}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={labelInk}
        fontSize="compact"
        position={[-0.085, 0.162, RIG_Z + 0.05]}
      >
        <span>{parts.volumeScale}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[THERM_X + 0.088, 0.255, RIG_Z + 0.02]}
      >
        <span>{parts.thermometer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.165, 0.068, RIG_Z + 0.085]}
      >
        <span>{parts.gasParticles}</span>
      </ThreeLabel>
    </group>
  );
}
