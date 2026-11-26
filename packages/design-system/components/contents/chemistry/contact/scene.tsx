import { useFrame, useThree } from "@react-three/fiber";
import type { ContactStage } from "@repo/design-system/components/contents/chemistry/contact/model";
import { evaluateContactStage } from "@repo/design-system/components/contents/chemistry/contact/model";
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

function ContactCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.65] : [0, 1.32, 3]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.5}
    />
  );
}

export function ContactSulfuricScene({
  parts,
  stage,
}: {
  readonly parts: Readonly<
    Record<
      "absorptionTower" | "acidPipe" | "burner" | "oleumTank" | "vanadiumBed",
      string
    >
  >;
  readonly stage: ContactStage;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const pulseRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const unit = evaluateContactStage(stage);

  useFrame((_, delta) => {
    if (!playing || pulseRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 2.4;
    const s = 1 + Math.sin(phaseRef.current) * 0.14;
    pulseRef.current.scale.set(s, s, s);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <ContactCamera />
      {/* Stage 1: Sulfur burner */}
      <mesh castShadow position={[-0.92, 0.42, 0]}>
        <boxGeometry args={[0.36, 0.56, 0.36]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.sulfurYellow}
          emissive={PROCESS_COLORS.hotRed}
          emissiveIntensity={stage === "roasting" ? 0.35 : 0}
        />
      </mesh>
      {/* Stage 2: Vanadium(V) oxide converter tower */}
      <mesh castShadow position={[-0.32, 0.58, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.88, 18]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.vanadiumOrange}
          emissive={PROCESS_COLORS.vanadiumOrange}
          emissiveIntensity={stage === "catalyticOxidation" ? 0.35 : 0}
        />
      </mesh>
      {/* Stage 3: Oleum absorption tower */}
      <mesh castShadow position={[0.32, 0.58, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.88, 18]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.oleumAmber}
          emissive={PROCESS_COLORS.oleumAmber}
          emissiveIntensity={stage === "oleumAbsorption" ? 0.35 : 0}
        />
      </mesh>
      {/* Stage 4: Controlled dilution tank & acid outlet */}
      <mesh castShadow position={[0.92, 0.44, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.62, 18]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.catalystTeal}
          emissive={PROCESS_COLORS.greenProduct}
          emissiveIntensity={stage === "dilution" ? 0.35 : 0}
        />
      </mesh>
      {/* Connecting gas/acid manifold pipe */}
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[1.84, 0.05, 0.05]} />
        <meshStandardMaterial color={PROCESS_COLORS.alloySteel} />
      </mesh>
      {/* Pulsing active stage beacon */}
      <group position={[unit.activeX, 1.12, 0]} ref={pulseRef}>
        <mesh>
          <octahedronGeometry args={[0.075, 0]} />
          <meshStandardMaterial color={PROCESS_COLORS.electronGold} />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.96, 0.86, 0]}
      >
        <span>{parts.burner}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.34, 1.18, 0]}
      >
        <span>{parts.vanadiumBed}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.34, 1.18, 0]}
      >
        <span>{parts.absorptionTower}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.96, 0.88, 0]}
      >
        <span>{parts.oleumTank}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.98, 0.14, 0.34]}
      >
        <span>{parts.acidPipe}</span>
      </ThreeLabel>
    </group>
  );
}
