import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useHormoneBotanyGeometries } from "@repo/design-system/components/contents/biology/hormone/botany";
import type { PhytohormoneId } from "@repo/design-system/components/contents/biology/hormone/model";
import { evaluatePhytohormone } from "@repo/design-system/components/contents/biology/hormone/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";
import { DoubleSide } from "three";

const ETHYLENE_PUFFS = [
  { id: "e1", pos: [0.14, 0.08, 0.08] as const },
  { id: "e2", pos: [-0.12, 0.11, 0.06] as const },
  { id: "e3", pos: [0.05, 0.15, -0.06] as const },
] as const;

function HormoneCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.4] : [0, 1.32, 2.82]}
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
  const ink = useLabelInk();
  const pulseRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const morph = evaluatePhytohormone(hormone);

  useVisualStop(() => {
    phaseRef.current = 0;
    if (pulseRef.current !== null) {
      pulseRef.current.scale.setScalar(1);
    }
  });

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
  const {
    budLeaves,
    calyx,
    fruit,
    lateralSprig,
    lowerLeaf,
    mainLeaf,
    pedicel,
    pot,
    stem,
  } = useHormoneBotanyGeometries(stemH, hormone === "abscisicAcid");

  return (
    <group>
      <SimulationTicker running={playing} />
      <HormoneCamera />

      {/* Terracotta planter pot + dark organic potting soil */}
      <mesh castShadow geometry={pot} receiveShadow>
        <SurfaceMaterial
          bump={0.45}
          color={BIOLOGY_COLORS.terracotta}
          roughness={0.72}
          surface="concrete"
        />
      </mesh>
      <mesh position={[0, 0.23, 0]} receiveShadow>
        <cylinderGeometry args={[0.275, 0.26, 0.04, 28]} />
        <SurfaceMaterial
          bump={0.9}
          color={BOTANY_COLORS.soilDark}
          repeat={[2, 2]}
          roughness={0.94}
          surface="concrete"
        />
      </mesh>

      {/* Curved herbaceous main stem + stem node collar */}
      <mesh castShadow geometry={stem} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.28}
          color={BOTANY_COLORS.stemGreen}
          roughness={0.48}
        />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.22 + stemH * 0.45, 0]}
        scale={[1.15, 0.72, 1.15]}
      >
        <sphereGeometry args={[0.052, 18, 14]} />
        <meshPhysicalMaterial
          clearcoat={0.32}
          color={BOTANY_COLORS.sepalGreen}
          roughness={0.44}
        />
      </mesh>

      {/* Sculpted apical shoot tip with unfurling primordia + auxin glow */}
      <group position={[0, 0.22 + stemH, 0]}>
        <mesh castShadow geometry={budLeaves}>
          <meshPhysicalMaterial
            clearcoat={0.34}
            roughness={0.44}
            side={DoubleSide}
            vertexColors
          />
        </mesh>
        <mesh castShadow position={[0, 0.04, 0]}>
          <sphereGeometry args={[0.044, 16, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={
              hormone === "auxin"
                ? BOTANY_COLORS.auxinDot
                : BOTANY_COLORS.windGreen
            }
            emissive={
              hormone === "auxin"
                ? BOTANY_COLORS.auxinDot
                : BOTANY_COLORS.sepalGreen
            }
            emissiveIntensity={hormone === "auxin" ? 0.45 : 0.06}
            roughness={0.34}
          />
        </mesh>
      </group>

      {/* Sculpted axillary lateral bud sprig scaling with cytokinin vs auxin */}
      <group
        position={[0.03, 0.22 + stemH * 0.46, 0.01]}
        rotation={[0, 0, 0.35]}
        scale={morph.lateralBudScale}
      >
        <mesh castShadow geometry={lateralSprig}>
          <meshPhysicalMaterial
            clearcoat={0.32}
            roughness={0.44}
            side={DoubleSide}
            vertexColors
          />
        </mesh>
      </group>

      {/* Botanical foliage leaves responding to ABA droop & yellowing */}
      <group
        position={[-0.02, 0.22 + stemH * 0.68, 0]}
        rotation={[0, 0, morph.leafDroop * 0.9]}
      >
        <mesh castShadow geometry={mainLeaf} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.36}
            clearcoatRoughness={0.34}
            roughness={0.46}
            side={DoubleSide}
            vertexColors
          />
        </mesh>
      </group>
      <group
        position={[-0.01, 0.22 + stemH * 0.38, -0.02]}
        rotation={[0, 0.35, morph.leafDroop * 0.7]}
      >
        <mesh castShadow geometry={lowerLeaf} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.34}
            roughness={0.48}
            side={DoubleSide}
            vertexColors
          />
        </mesh>
      </group>

      {/* Curved pedicel & glossy ripening fruit with green star calyx */}
      <mesh castShadow geometry={pedicel}>
        <meshStandardMaterial
          color={BOTANY_COLORS.sepalGreen}
          roughness={0.54}
        />
      </mesh>
      <group position={[0.24, 0.14 + stemH * 0.68, 0.08]} ref={pulseRef}>
        <mesh castShadow geometry={fruit} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.82}
            clearcoatRoughness={0.14}
            color={fruitColor}
            roughness={0.26}
          />
        </mesh>
        <mesh castShadow geometry={calyx}>
          <meshPhysicalMaterial
            clearcoat={0.28}
            roughness={0.5}
            side={DoubleSide}
            vertexColors
          />
        </mesh>
        {hormone === "ethylene"
          ? Arr.map(ETHYLENE_PUFFS, (puff) => (
              <mesh key={puff.id} position={puff.pos}>
                <sphereGeometry args={[0.032, 12, 10]} />
                <meshPhysicalMaterial
                  color={BOTANY_COLORS.fruitCoral}
                  depthWrite={false}
                  emissive={BOTANY_COLORS.fruitCoral}
                  emissiveIntensity={0.35}
                  opacity={0.48}
                  roughness={0.2}
                  transparent
                />
              </mesh>
            ))
          : null}
      </group>

      {/* Dynamic light/dark-mode labels */}
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[0, 0.44 + stemH, 0]}
      >
        <span>{parts.shootTip}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[0.72, 0.18 + stemH * 0.68, 0]}
      >
        <span>{parts.fruit}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[0.72, 0.22 + stemH * 0.4, 0]}
      >
        <span>{parts.lateralBud}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[-0.72, 0.24 + stemH * 0.72, 0]}
      >
        <span>{parts.leaf}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[-0.72, 0.22 + stemH * 0.36, 0]}
      >
        <span>{parts.stemNode}</span>
      </ThreeLabel>
    </group>
  );
}
