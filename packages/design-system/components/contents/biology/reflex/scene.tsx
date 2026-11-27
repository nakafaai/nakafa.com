import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  buildFusiformBelly,
  useMuscleMaterials,
} from "@repo/design-system/components/contents/biology/limb/anatomy";
import { useReflexGeometries } from "@repo/design-system/components/contents/biology/reflex/anatomy";
import type { ReflexType } from "@repo/design-system/components/contents/biology/reflex/model";
import { evaluateReflex } from "@repo/design-system/components/contents/biology/reflex/model";
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
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";

function ReflexCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.92, 4.25] : [0, 1.56, 3.65]}
      cameraTarget={[0, 0.56, 0.1]}
      fov={38}
      maxDistance={6.6}
      minDistance={1.5}
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
  const ink = useLabelInk();
  const pulseRef = useRef<Group>(null);
  const profile = evaluateReflex(reflex, step);
  const muscleMats = useMuscleMaterials();
  const {
    greyMatter,
    impulseCurve,
    motorMyelin,
    motorTube,
    relayTube,
    sensoryMyelin,
    sensoryTube,
    whiteMatter,
  } = useReflexGeometries();

  const effectorBelly = useMemo(() => {
    const geo = buildFusiformBelly(0.48, 0.115);
    geo.rotateZ(Math.PI / 2);
    return geo;
  }, []);

  useEffect(() => () => effectorBelly.dispose(), [effectorBelly]);

  useVisualStop(() => {
    onStep(-step);
  });

  const normalizedT = Math.min(1, Math.max(0, step / 100));
  const pulsePos = impulseCurve.getPoint(normalizedT);
  const muscleContracting = step >= 78;

  useFrame((_, delta) => {
    if (playing) {
      onStep(simulationStep(delta) * 26);
    }
    if (pulseRef.current !== null) {
      const pt = impulseCurve.getPoint(Math.min(1, Math.max(0, step / 100)));
      pulseRef.current.position.set(pt.x, pt.y, pt.z);
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <ReflexCamera />

      {/* Anatomical spinal cord cross-section: white matter + butterfly H-shaped grey matter */}
      <group position={[0, 0.58, 0]}>
        <mesh castShadow geometry={whiteMatter} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.45}
            clearcoatRoughness={0.28}
            color={HOMEOSTASIS_COLORS.whiteMatter}
            roughness={0.42}
          />
        </mesh>
        <mesh castShadow geometry={greyMatter} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.32}
            color={HOMEOSTASIS_COLORS.greyMatter}
            roughness={0.48}
          />
        </mesh>
        {/* Central spinal canal lumen */}
        <mesh position={[0, 0, 0.21]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.04, 14]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.hairShaft}
            roughness={0.7}
          />
        </mesh>
      </group>

      {/* Curved myelinated sensory neuron & dorsal root ganglion */}
      <mesh castShadow geometry={sensoryTube}>
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={HOMEOSTASIS_COLORS.sensoryNeuron}
          roughness={0.34}
        />
      </mesh>
      <mesh castShadow position={[-0.62, 0.84, 0.16]} scale={[1.3, 0.9, 0.9]}>
        <sphereGeometry args={[0.068, 20, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.55}
          color={HOMEOSTASIS_COLORS.dorsalRoot}
          roughness={0.3}
        />
      </mesh>
      {Arr.map(sensoryMyelin, (node) => (
        <mesh key={node.id} position={node.pos}>
          <sphereGeometry args={[0.036, 12, 10]} />
          <meshPhysicalMaterial
            clearcoat={0.45}
            color={HOMEOSTASIS_COLORS.whiteMatter}
            roughness={0.36}
          />
        </mesh>
      ))}

      {/* Relay interneuron inside butterfly grey matter (present in withdrawal reflex) */}
      {profile.hasRelay ? (
        <mesh castShadow geometry={relayTube}>
          <meshPhysicalMaterial
            clearcoat={0.52}
            color={HOMEOSTASIS_COLORS.relayNeuron}
            roughness={0.32}
          />
        </mesh>
      ) : null}

      {/* Curved myelinated motor neuron exiting ventral root */}
      <mesh castShadow geometry={motorTube}>
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={HOMEOSTASIS_COLORS.motorNeuron}
          roughness={0.34}
        />
      </mesh>
      {Arr.map(motorMyelin, (node) => (
        <mesh key={node.id} position={node.pos}>
          <sphereGeometry args={[0.036, 12, 10]} />
          <meshPhysicalMaterial
            clearcoat={0.45}
            color={HOMEOSTASIS_COLORS.whiteMatter}
            roughness={0.36}
          />
        </mesh>
      ))}

      {/* Layered sculpted skin / cutaneous receptor dome on left */}
      <group position={[-1.16, 0.24, 0.34]}>
        {/* Subcutaneous adipose layer cushion */}
        <mesh
          castShadow
          position={[0, -0.04, 0]}
          receiveShadow
          scale={[1.15, 0.45, 0.95]}
        >
          <sphereGeometry args={[0.2, 22, 16]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.fatLayer}
            roughness={0.72}
          />
        </mesh>
        {/* Sculpted dermal + epidermal dome */}
        <mesh
          castShadow
          position={[0, 0.02, 0]}
          receiveShadow
          scale={[1.12, 0.48, 0.92]}
        >
          <sphereGeometry
            args={[0.19, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]}
          />
          <meshPhysicalMaterial
            clearcoat={0.28}
            color={HOMEOSTASIS_COLORS.epidermis}
            roughness={0.55}
          />
        </mesh>
        {/* Tactile/thermoreceptor corpuscle bulb */}
        <mesh castShadow position={[0.02, 0.09, 0.05]}>
          <sphereGeometry args={[0.05, 16, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.65}
            color={HOMEOSTASIS_COLORS.receptor}
            emissive={HOMEOSTASIS_COLORS.receptor}
            emissiveIntensity={step < 20 ? 0.45 : 0.1}
            roughness={0.28}
          />
        </mesh>
      </group>

      {/* Striated skeletal effector muscle + pearlescent tendons on right */}
      <group position={[1.18, 0.28, 0.34]}>
        <mesh
          castShadow
          geometry={effectorBelly}
          material={muscleContracting ? muscleMats.active : muscleMats.relaxed}
          scale={muscleContracting ? [0.88, 1.24, 1.2] : [1, 1, 1]}
        />
        <mesh
          castShadow
          material={muscleMats.tendon}
          position={[-0.27, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.022, 0.032, 0.14, 12]} />
        </mesh>
        <mesh
          castShadow
          material={muscleMats.tendon}
          position={[0.27, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.032, 0.022, 0.14, 12]} />
        </mesh>
      </group>

      {/* Travelling glowing action-potential impulse */}
      <group position={[pulsePos.x, pulsePos.y, pulsePos.z]} ref={pulseRef}>
        <mesh>
          <sphereGeometry args={[0.062, 18, 16]} />
          <meshPhysicalMaterial
            clearcoat={0.8}
            color={HOMEOSTASIS_COLORS.impulseGlow}
            emissive={HOMEOSTASIS_COLORS.impulseGlow}
            emissiveIntensity={0.85}
            roughness={0.18}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.105, 16, 12]} />
          <meshBasicMaterial
            color={HOMEOSTASIS_COLORS.impulseGlow}
            depthWrite={false}
            opacity={0.25}
            transparent
          />
        </mesh>
      </group>

      {/* Crisp non-overlapping labels using dynamic light/dark ink */}
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[-1.08, -0.04, 0.56]}
      >
        <span>{parts.receptor}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.86, 1.02, 0.18]}>
        <span>
          {parts.sensoryNeuron} ({parts.dorsalRoot})
        </span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0, 1.24, 0]}>
        <span>
          {parts.greyMatter} / {parts.whiteMatter}
        </span>
      </ThreeLabel>
      {profile.hasRelay ? (
        <ThreeLabel color={ink} fontSize="compact" position={[0, 0.14, 0.36]}>
          <span>{parts.relayNeuron}</span>
        </ThreeLabel>
      ) : null}
      <ThreeLabel color={ink} fontSize="compact" position={[1.08, 0.78, 0.18]}>
        <span>
          {parts.motorNeuron} ({parts.ventralRoot})
        </span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[1.06, -0.04, 0.56]}>
        <span>{parts.effector}</span>
      </ThreeLabel>
    </group>
  );
}
