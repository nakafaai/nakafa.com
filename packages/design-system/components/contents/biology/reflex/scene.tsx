import { useFrame, useThree } from "@react-three/fiber";
import type { ReflexType } from "@repo/design-system/components/contents/biology/reflex/model";
import { evaluateReflex } from "@repo/design-system/components/contents/biology/reflex/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { useRef } from "react";
import type { Mesh } from "three";

const ARC_POINTS: readonly (readonly [number, number, number])[] = [
  [-1.08, 0.28, 0.36],
  [-0.56, 0.72, 0.14],
  [0, 0.62, 0],
  [0.56, 0.36, -0.14],
  [1.08, 0.28, 0.36],
];

function ReflexCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.85, 3.6] : [0, 1.45, 2.9]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.4}
    />
  );
}

export function ReflexArcScene({
  onStep,
  parts,
  reflex,
  step,
}: {
  readonly onStep: (delta: number) => void;
  readonly parts: Readonly<
    Record<
      | "dorsalRoot"
      | "effector"
      | "greyMatter"
      | "motorNeuron"
      | "receptor"
      | "relayNeuron"
      | "sensoryNeuron"
      | "ventralRoot"
      | "whiteMatter",
      string
    >
  >;
  readonly reflex: ReflexType;
  readonly step: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const pulseRef = useRef<Mesh>(null);
  const profile = evaluateReflex(reflex, step);

  useFrame((_, delta) => {
    if (playing) {
      onStep(simulationStep(delta) * 26);
    }
    if (pulseRef.current !== null) {
      const point = ARC_POINTS[profile.activeStage] ?? ARC_POINTS[0];
      pulseRef.current.position.set(point[0], point[1], point[2]);
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <ReflexCamera />
      {/* Spinal cord white matter oval */}
      <mesh castShadow position={[0, 0.56, 0]} scale={[1.25, 0.92, 0.52]}>
        <cylinderGeometry args={[0.42, 0.42, 0.48, 24]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.whiteMatter}
          roughness={0.55}
        />
      </mesh>
      {/* Butterfly grey matter H-core */}
      <mesh castShadow position={[0, 0.58, 0.14]}>
        <boxGeometry args={[0.44, 0.36, 0.14]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.greyMatter}
          roughness={0.52}
        />
      </mesh>
      {/* Dorsal root & sensory pathway */}
      <mesh position={[-0.64, 0.54, 0.2]} rotation={[0, 0, 0.56]}>
        <cylinderGeometry args={[0.04, 0.04, 0.98, 12]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.sensoryNeuron}
          roughness={0.4}
        />
      </mesh>
      {/* Relay neuron (present in withdrawal reflex) */}
      {profile.hasRelay ? (
        <mesh position={[0, 0.62, 0.24]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.036, 0.036, 0.34, 12]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.relayNeuron}
            roughness={0.38}
          />
        </mesh>
      ) : null}
      {/* Ventral root & motor pathway */}
      <mesh position={[0.64, 0.42, 0.18]} rotation={[0, 0, -0.42]}>
        <cylinderGeometry args={[0.04, 0.04, 0.98, 12]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.motorNeuron}
          roughness={0.4}
        />
      </mesh>
      {/* Receptor pad on left */}
      <mesh castShadow position={[-1.08, 0.24, 0.36]}>
        <boxGeometry args={[0.32, 0.22, 0.34]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.receptor}
          roughness={0.48}
        />
      </mesh>
      {/* Effector muscle on right */}
      <mesh
        castShadow
        position={[1.08, 0.24, 0.36]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <capsuleGeometry args={[0.14, 0.32, 8, 14]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.effector}
          roughness={0.45}
        />
      </mesh>
      {/* Action-potential travelling pulse */}
      <mesh position={[-1.08, 0.28, 0.36]} ref={pulseRef}>
        <sphereGeometry args={[0.085, 14, 12]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.impulseGlow}
          emissive={HOMEOSTASIS_COLORS.impulseGlow}
          emissiveIntensity={0.65}
          roughness={0.25}
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[-1.08, 0.52, 0.4]}
      >
        <span>{parts.receptor}</span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.68, 0.88, 0.2]}
      >
        <span>
          {parts.sensoryNeuron} ({parts.dorsalRoot})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.04, 0]}
      >
        <span>
          {parts.greyMatter} / {parts.whiteMatter}
        </span>
      </ThreeLabel>
      {profile.hasRelay ? (
        <ThreeLabel
          color={HOMEOSTASIS_COLORS.labelInk}
          fontSize="compact"
          position={[0, 0.78, 0.32]}
        >
          <span>{parts.relayNeuron}</span>
        </ThreeLabel>
      ) : null}
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0.68, 0.72, 0.2]}
      >
        <span>
          {parts.motorNeuron} ({parts.ventralRoot})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[1.08, 0.52, 0.4]}
      >
        <span>{parts.effector}</span>
      </ThreeLabel>
    </group>
  );
}
