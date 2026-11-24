import { useFrame, useThree } from "@react-three/fiber";
import type { GlucoseState } from "@repo/design-system/components/contents/biology/glucose/model";
import { evaluateGlucoseFeedback } from "@repo/design-system/components/contents/biology/glucose/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function GlucoseCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.85, 3.6] : [0, 1.45, 2.85]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.4}
    />
  );
}

export function GlucoseFeedbackScene({
  glucoseLevel,
  parts,
  state,
}: {
  readonly glucoseLevel: number;
  readonly parts: Readonly<
    Record<
      | "alphaCell"
      | "betaCell"
      | "bloodVessel"
      | "glycogen"
      | "liver"
      | "pancreas",
      string
    >
  >;
  readonly state: GlucoseState;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const flowRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluateGlucoseFeedback(state, glucoseLevel);

  const dots = useMemo(
    () =>
      Arr.makeBy(
        Math.min(18, Math.max(3, reading.vesselParticles)),
        (index) => ({
          id: `gl-${index}`,
          offset: index * 0.28,
        })
      ),
    [reading.vesselParticles]
  );

  useFrame((_, delta) => {
    if (!playing || flowRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.9;
    for (let i = 0; i < flowRef.current.children.length; i += 1) {
      const child = flowRef.current.children[i];
      const dot = dots[i];
      if (child !== undefined && dot !== undefined) {
        const x = -0.9 + ((phaseRef.current + dot.offset) % 1.8);
        child.position.set(x, 0.52, 0.08 * Math.sin(x * 4));
      }
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <GlucoseCamera />
      {/* Pancreas with alpha and beta islet clusters on left */}
      <group position={[-0.95, 0.56, 0]}>
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.2, 0.44, 10, 16]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.pancreasTissue}
            roughness={0.5}
          />
        </mesh>
        <mesh position={[-0.1, 0.14, 0.16]}>
          <sphereGeometry args={[0.08, 12, 10]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.alphaCell}
            roughness={0.38}
          />
        </mesh>
        <mesh position={[0.1, -0.06, 0.16]}>
          <sphereGeometry args={[0.08, 12, 10]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.betaCell}
            roughness={0.38}
          />
        </mesh>
      </group>
      {/* Central blood vessel bridge */}
      <mesh position={[0, 0.52, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 1.8, 20]} />
        <meshPhysicalMaterial
          color={HOMEOSTASIS_COLORS.vesselWall}
          opacity={0.32}
          roughness={0.25}
          transparent
        />
      </mesh>
      {/* Circulating glucose spheres */}
      <group ref={flowRef}>
        {Arr.map(dots, (dot) => (
          <mesh key={dot.id} position={[-0.8 + (dot.offset % 1.6), 0.52, 0]}>
            <sphereGeometry args={[0.044, 10, 8]} />
            <meshStandardMaterial
              color={HOMEOSTASIS_COLORS.glucoseMolecule}
              roughness={0.35}
            />
          </mesh>
        ))}
      </group>
      {/* Liver lobe & glycogen store on right */}
      <group position={[0.96, 0.58, 0]}>
        <mesh castShadow scale={[1.15, 0.85, 0.72]}>
          <dodecahedronGeometry args={[0.38, 1]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.liverTissue}
            roughness={0.52}
          />
        </mesh>
        <mesh
          position={[0, 0.08, 0.24]}
          scale={[
            reading.glycogenScale,
            reading.glycogenScale,
            reading.glycogenScale,
          ]}
        >
          <octahedronGeometry args={[0.12, 0]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.glycogenCluster}
            roughness={0.38}
          />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.95, 0.96, 0]}
      >
        <span>
          {parts.pancreas} ({parts.alphaCell} / {parts.betaCell})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.84, 0]}
      >
        <span>{parts.bloodVessel}</span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0.96, 1.02, 0]}
      >
        <span>
          {parts.liver} ({parts.glycogen})
        </span>
      </ThreeLabel>
    </group>
  );
}
