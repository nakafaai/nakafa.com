import { useFrame, useThree } from "@react-three/fiber";
import type { RingMode } from "@repo/design-system/components/contents/biology/phloem/model";
import { evaluatePhloemFlow } from "@repo/design-system/components/contents/biology/phloem/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { useRef } from "react";
import type { Group } from "three";

function PhloemCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.3] : [0, 1.32, 2.7]}
      cameraTarget={[0, 0.64, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function PhloemTranslocationScene({
  mode,
  parts,
  sourceSucrose,
}: {
  readonly mode: RingMode;
  readonly parts: Readonly<
    Record<
      "companionCell" | "sievePlate" | "sieveTube" | "sucrose" | "xylem",
      string
    >
  >;
  readonly sourceSucrose: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const sucroseRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const flow = evaluatePhloemFlow(mode, sourceSucrose);

  useFrame((_, delta) => {
    if (!playing || sucroseRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * flow.flowRate;
    const t = phaseRef.current % 1;
    const y = mode === "ringed" ? 1.12 - t * 0.36 : 1.12 - t * 0.94;
    sucroseRef.current.position.set(0, y, 0.2);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <PhloemCamera />
      {/* Adjacent xylem vessel on left supplying osmotic water */}
      <mesh castShadow position={[-0.44, 0.64, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 1.08, 16]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.xylemCrimson}
          roughness={0.5}
        />
      </mesh>
      {/* Upper sieve tube (bulges when bark is ringed) */}
      <mesh
        castShadow
        position={[0, 0.92, 0]}
        scale={[flow.bulgeScale, 1, flow.bulgeScale]}
      >
        <cylinderGeometry args={[0.14, 0.14, 0.5, 18]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.phloemGreen}
          opacity={0.78}
          roughness={0.4}
          transparent
        />
      </mesh>
      {/* Perforated sieve plate */}
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.04, 18]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.sievePlate}
          roughness={0.45}
        />
      </mesh>
      {/* Lower sieve tube (removed in ringed gap) */}
      {mode === "intact" ? (
        <mesh castShadow position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.52, 18]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.phloemGreen}
            opacity={0.78}
            roughness={0.4}
            transparent
          />
        </mesh>
      ) : (
        <mesh castShadow position={[0, 0.24, 0]}>
          <cylinderGeometry args={[0.11, 0.12, 0.26, 16]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.barkBrown}
            roughness={0.75}
          />
        </mesh>
      )}
      {/* Nucleated companion cell on right */}
      <mesh castShadow position={[0.32, 0.86, 0]}>
        <boxGeometry args={[0.18, 0.44, 0.24]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.companionTeal}
          roughness={0.5}
        />
      </mesh>
      {/* Translocating sucrose granule */}
      <group position={[0, 0.9, 0.2]} ref={sucroseRef}>
        <mesh>
          <octahedronGeometry args={[0.056, 0]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.sucroseGold}
            roughness={0.28}
          />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 0.9, 0]}
      >
        <span>{parts.xylem}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.24, 0]}
      >
        <span>{parts.sieveTube}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.68, 0.62, 0]}
      >
        <span>{parts.sievePlate}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.76, 0.88, 0]}
      >
        <span>{parts.companionCell}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.66, 0.42, 0]}
      >
        <span>{parts.sucrose}</span>
      </ThreeLabel>
    </group>
  );
}
