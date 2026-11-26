import { useFrame, useThree } from "@react-three/fiber";
import { evaluateHaberConverter } from "@repo/design-system/components/contents/chemistry/haber/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { useRef } from "react";
import type { Group } from "three";

function HaberCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.55] : [0, 1.32, 2.9]}
      cameraTarget={[0, 0.58, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.5}
    />
  );
}

export function HaberConverterScene({
  parts,
  pressureAtm,
  temperatureC,
}: {
  readonly parts: Readonly<
    Record<
      | "compressor"
      | "coolingCondenser"
      | "ironCatalystBed"
      | "liquidAmmonia"
      | "recyclePipe",
      string
    >
  >;
  readonly pressureAtm: number;
  readonly temperatureC: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const flowRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluateHaberConverter(temperatureC, pressureAtm);

  useFrame((_, delta) => {
    if (!playing || flowRef.current === null) {
      return;
    }
    phaseRef.current +=
      simulationStep(delta) * (0.6 + reading.relativeRate / 65);
    const t = phaseRef.current % 1;
    flowRef.current.position.set(-0.85 + t * 1.7, 0.72, 0.22);
  });

  const ammoniaH = 0.08 + (reading.yieldPercent / 75) * 0.42;

  return (
    <group>
      <SimulationTicker running={playing} />
      <HaberCamera />
      {/* Gas compressor unit (left) */}
      <mesh castShadow position={[-0.86, 0.52, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.52, 18]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.alloySteel}
          roughness={0.4}
        />
      </mesh>
      {/* Iron catalyst converter tower (center) */}
      <mesh castShadow position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.88, 20]} />
        <meshStandardMaterial color={PROCESS_COLORS.ironDark} roughness={0.5} />
      </mesh>
      {/* Glowing iron catalyst bed trays */}
      <mesh position={[0, 0.62, 0.16]}>
        <boxGeometry args={[0.36, 0.14, 0.12]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.vanadiumOrange}
          emissive={PROCESS_COLORS.hotRed}
          emissiveIntensity={temperatureC > 480 ? 0.35 : 0.12}
        />
      </mesh>
      {/* Cooling condenser & liquid ammonia sump (right) */}
      <mesh position={[0.84, 0.56, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.76, 18, 1, true]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.glassClear}
          opacity={0.38}
          side={2}
          transparent
        />
      </mesh>
      <mesh position={[0.84, 0.18 + ammoniaH * 0.5, 0]}>
        <cylinderGeometry args={[0.2, 0.2, ammoniaH, 16]} />
        <meshStandardMaterial color={PROCESS_COLORS.ammoniaCyan} />
      </mesh>
      {/* Overhead unreacted gas recycle loop */}
      <mesh position={[0, 1.12, 0]}>
        <boxGeometry args={[1.72, 0.05, 0.05]} />
        <meshStandardMaterial color={PROCESS_COLORS.catalystTeal} />
      </mesh>
      {/* Moving N2/H2 gas pulse */}
      <group position={[0, 0.72, 0.22]} ref={flowRef}>
        <mesh>
          <sphereGeometry args={[0.048, 12, 10]} />
          <meshStandardMaterial color={PROCESS_COLORS.electronGold} />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.9, 0.9, 0]}
      >
        <span>{parts.compressor}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.28, 0]}
      >
        <span>{parts.recyclePipe}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.2, 0.32]}
      >
        <span>{parts.ironCatalystBed}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.92, 0.98, 0]}
      >
        <span>{parts.coolingCondenser}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.92, 0.24, 0.26]}
      >
        <span>{parts.liquidAmmonia}</span>
      </ThreeLabel>
    </group>
  );
}
