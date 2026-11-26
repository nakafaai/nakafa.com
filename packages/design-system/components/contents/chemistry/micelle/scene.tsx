import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  WashTankChamber,
  WovenFabricSwatch,
} from "@repo/design-system/components/contents/chemistry/micelle/geometry";
import type {
  MicelleStage,
  WaterType,
} from "@repo/design-system/components/contents/chemistry/micelle/model";
import { evaluateMicelleCleaning } from "@repo/design-system/components/contents/chemistry/micelle/model";
import {
  FabricScumDeposits,
  SurfactantMicelle,
} from "@repo/design-system/components/contents/chemistry/micelle/parts";
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
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const FLOW_STREAKS = [
  { id: "flow-0", offset: 0, y: 0.172, z: -0.048 },
  { id: "flow-1", offset: 0.18, y: 0.142, z: 0.046 },
  { id: "flow-2", offset: 0.35, y: 0.112, z: -0.056 },
  { id: "flow-3", offset: 0.52, y: 0.162, z: 0.022 },
  { id: "flow-4", offset: 0.68, y: 0.088, z: 0.052 },
  { id: "flow-5", offset: 0.84, y: 0.132, z: -0.018 },
] as const;

function flowXAt(offset: number, phase: number): number {
  const u = (offset + phase) % 1;
  return -0.155 + u * 0.31;
}

function MicelleCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 0.25, 0.78] : [0, 0.21, 0.62]}
      cameraTarget={[0, 0.125, 0]}
      fov={37}
      maxDistance={1.5}
      minDistance={0.28}
    />
  );
}

export function SoapMicelleScene({
  parts,
  stage,
  waterType,
}: {
  readonly parts: Readonly<
    Record<
      | "fabric"
      | "greaseDrop"
      | "hydrophilicHead"
      | "hydrophobicTail"
      | "waterFlow",
      string
    >
  >;
  readonly stage: MicelleStage;
  readonly waterType: WaterType;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const labelInk = useLabelInk();
  const micelleRef = useRef<Group>(null);
  const flowRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const pose = evaluateMicelleCleaning(stage, waterType);
  // Map model dropletY (0.24..0.88) into bench-scale tank interior (0.054..0.152 m)
  const tankY = 0.054 + (pose.dropletY - 0.24) * 0.153;

  useVisualStop(() => {
    phaseRef.current = 0;
    if (micelleRef.current !== null) {
      micelleRef.current.position.set(0, tankY, 0);
      micelleRef.current.rotation.set(0, 0, 0);
    }
    if (flowRef.current !== null) {
      for (let i = 0; i < flowRef.current.children.length; i += 1) {
        const child = flowRef.current.children[i];
        const streak = FLOW_STREAKS[i];
        if (child !== undefined && streak !== undefined) {
          child.position.set(flowXAt(streak.offset, 0), streak.y, streak.z);
        }
      }
    }
    invalidate();
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    const flowSpeed = stage === "rinseAway" ? 0.62 : 0.34;
    phaseRef.current += simulationStep(delta) * flowSpeed;
    const t = phaseRef.current;

    if (micelleRef.current !== null) {
      if (stage === "rinseAway" && !pose.hasScum) {
        micelleRef.current.position.set(
          Math.sin(t * 2.2) * 0.055,
          tankY + Math.cos(t * 2.8) * 0.008,
          0
        );
        micelleRef.current.rotation.set(t * 0.6, t * 1.1, -t * 0.9);
      } else {
        micelleRef.current.position.set(
          0,
          tankY + Math.sin(t * 2.5) * 0.003,
          0
        );
        micelleRef.current.rotation.set(
          0,
          Math.sin(t * 1.4) * 0.22,
          Math.sin(t * 1.8) * 0.1
        );
      }
    }

    if (flowRef.current !== null) {
      for (let i = 0; i < flowRef.current.children.length; i += 1) {
        const child = flowRef.current.children[i];
        const streak = FLOW_STREAKS[i];
        if (child !== undefined && streak !== undefined) {
          child.position.set(
            flowXAt(streak.offset, t),
            streak.y + Math.sin(t * 4 + i) * 0.003,
            streak.z
          );
        }
      }
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <MicelleCamera />
      <LabBench width={2.6} />

      <WashTankChamber hasScum={pose.hasScum} />
      <WovenFabricSwatch />
      {pose.hasScum ? <FabricScumDeposits /> : null}

      {/* Animated horizontal wash-flow streamlines across the aqueous medium */}
      <group ref={flowRef}>
        {Arr.map(FLOW_STREAKS, (streak) => (
          <mesh
            key={streak.id}
            position={[flowXAt(streak.offset, 0), streak.y, streak.z]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <capsuleGeometry args={[0.0018, 0.026, 6, 10]} />
            <meshBasicMaterial
              color={
                pose.hasScum
                  ? ORGANIC_COLORS.saltCrystal
                  : BENCH_COLORS.streamGlint
              }
              opacity={0.58}
              transparent
            />
          </mesh>
        ))}
      </group>

      {/* Glossy grease droplet and 3D spherical surfactant micelle */}
      <group position={[0, tankY, 0]} ref={micelleRef}>
        <SurfactantMicelle
          hasScum={pose.hasScum}
          soapCount={pose.soapCount}
          stage={stage}
        />
      </group>

      {/* Well-separated adaptive-ink labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.175, 0.038, 0.11]}
      >
        <span>{parts.fabric}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.145, tankY + 0.015, 0.035]}
      >
        <span>{parts.greaseDrop}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.155, tankY + 0.058, 0.02]}
      >
        <span>{parts.hydrophilicHead}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.155, Math.max(0.068, tankY - 0.026), 0.04]}
      >
        <span>{parts.hydrophobicTail}</span>
      </ThreeLabel>
      <ThreeLabel color={labelInk} fontSize="compact" position={[0, 0.244, 0]}>
        <span>{parts.waterFlow}</span>
      </ThreeLabel>
    </group>
  );
}
