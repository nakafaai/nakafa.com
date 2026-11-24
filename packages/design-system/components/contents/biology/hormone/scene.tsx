import { useFrame, useThree } from "@react-three/fiber";
import type { PhytohormoneId } from "@repo/design-system/components/contents/biology/hormone/model";
import { evaluatePhytohormone } from "@repo/design-system/components/contents/biology/hormone/model";
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

function HormoneCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.3] : [0, 1.35, 2.7]}
      cameraTarget={[0, 0.72, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

function fruitTint(ripeness: number): string {
  if (ripeness > 0.8) {
    return BOTANY_COLORS.fruitRed;
  }
  if (ripeness > 0.3) {
    return BOTANY_COLORS.fruitCoral;
  }
  return BOTANY_COLORS.healthyLeaf;
}

export function PhytohormoneScene({
  hormone,
  parts,
}: {
  readonly hormone: PhytohormoneId;
  readonly parts: Readonly<
    Record<"fruit" | "lateralBud" | "leaf" | "shootTip" | "stemNode", string>
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const pulseRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const morph = evaluatePhytohormone(hormone);

  useFrame((_, delta) => {
    if (!playing || pulseRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 2.2;
    const s = 1 + Math.sin(phaseRef.current) * 0.06;
    pulseRef.current.scale.set(s, s, s);
  });

  const stemH = 0.85 * morph.stemScale;
  const fruitColor = fruitTint(morph.fruitRipeness);

  return (
    <group>
      <SimulationTicker running={playing} />
      <HormoneCamera />
      {/* Potted soil base */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.38, 0.34, 0.2, 20]} />
        <meshStandardMaterial color={BOTANY_COLORS.soilDark} roughness={0.85} />
      </mesh>
      {/* Main stem */}
      <mesh castShadow position={[0, 0.2 + stemH * 0.5, 0]}>
        <cylinderGeometry args={[0.04, 0.052, stemH, 14]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.stemGreen}
          roughness={0.55}
        />
      </mesh>
      {/* Stem node swelling */}
      <mesh position={[0, 0.2 + stemH * 0.45, 0]}>
        <sphereGeometry args={[0.068, 12, 10]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.sepalGreen}
          roughness={0.5}
        />
      </mesh>
      {/* Shoot tip apical meristem */}
      <mesh position={[0, 0.24 + stemH, 0]}>
        <coneGeometry args={[0.065, 0.14, 12]} />
        <meshStandardMaterial
          color={
            hormone === "auxin"
              ? BOTANY_COLORS.auxinDot
              : BOTANY_COLORS.healthyLeaf
          }
          roughness={0.42}
        />
      </mesh>
      {/* Lateral bud */}
      <mesh
        castShadow
        position={[0.14 * morph.lateralBudScale, 0.2 + stemH * 0.48, 0]}
        rotation={[0, 0, -0.7]}
        scale={[
          morph.lateralBudScale,
          morph.lateralBudScale,
          morph.lateralBudScale,
        ]}
      >
        <coneGeometry args={[0.05, 0.16, 10]} />
        <meshStandardMaterial
          color={
            hormone === "cytokinin"
              ? BOTANY_COLORS.windGreen
              : BOTANY_COLORS.healthyLeaf
          }
          roughness={0.5}
        />
      </mesh>
      {/* Leaf responding to ABA droop */}
      <mesh
        castShadow
        position={[-0.24, 0.2 + stemH * 0.65 - morph.leafDroop * 0.14, 0]}
        rotation={[0, 0, 0.35 - morph.leafDroop]}
        scale={[1.5, 0.26, 0.72]}
      >
        <sphereGeometry args={[0.16, 12, 10]} />
        <meshStandardMaterial
          color={
            hormone === "abscisicAcid"
              ? BOTANY_COLORS.chlorosisYellow
              : BOTANY_COLORS.healthyLeaf
          }
          roughness={0.5}
        />
      </mesh>
      {/* Ripening fruit */}
      <group position={[0.22, 0.2 + stemH * 0.72, 0.08]} ref={pulseRef}>
        <mesh castShadow>
          <sphereGeometry args={[0.11, 14, 12]} />
          <meshStandardMaterial color={fruitColor} roughness={0.35} />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.38 + stemH, 0]}
      >
        <span>{parts.shootTip}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.68, 0.2 + stemH * 0.74, 0]}
      >
        <span>{parts.fruit}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.68, 0.2 + stemH * 0.44, 0]}
      >
        <span>{parts.lateralBud}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.68, 0.2 + stemH * 0.65, 0]}
      >
        <span>{parts.leaf}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.66, 0.2 + stemH * 0.34, 0]}
      >
        <span>{parts.stemNode}</span>
      </ThreeLabel>
    </group>
  );
}
