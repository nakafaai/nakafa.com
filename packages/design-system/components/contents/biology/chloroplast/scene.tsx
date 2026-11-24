import { useFrame, useThree } from "@react-three/fiber";
import type {
  ChloroplastReading,
  ChloroplastStage,
} from "@repo/design-system/components/contents/biology/chloroplast/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const GRANA_STACKS = [
  { id: "g1", x: -0.58, z: -0.1 },
  { id: "g2", x: -0.16, z: 0.14 },
  { id: "g3", x: 0.28, z: -0.14 },
] as const;

const THYLAKOID_Y = [0.22, 0.32, 0.42, 0.52, 0.62] as const;

function ChloroplastCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.45, 1.8, 3.2] : [0.35, 1.45, 2.55]}
      cameraTarget={[0, 0.44, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.3}
    />
  );
}

export function ChloroplastScene({
  parts,
  reading,
  stage,
}: {
  readonly parts: Readonly<
    Record<
      | "atp"
      | "co2"
      | "glucose"
      | "granum"
      | "nadph"
      | "oxygen"
      | "stroma"
      | "thylakoid"
      | "water",
      string
    >
  >;
  readonly reading: ChloroplastReading;
  readonly stage: ChloroplastStage;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const shuttlesRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  useFrame((_, delta) => {
    if (!playing || shuttlesRef.current === null) {
      return;
    }
    const speed = 0.8 + reading.photosynthesisRate * 2.2;
    phaseRef.current += simulationStep(delta) * speed;
    shuttlesRef.current.position.x = Math.sin(phaseRef.current) * 0.22;
    shuttlesRef.current.position.y = Math.cos(phaseRef.current * 1.3) * 0.06;
  });

  const granaActive = stage !== "calvinCycle";
  const stromaActive = stage !== "lightDependent";

  return (
    <group>
      <SimulationTicker running={playing} />
      <ChloroplastCamera />
      {/* Double-membrane chloroplast cutaway shell */}
      <mesh
        castShadow
        position={[0, 0.42, 0]}
        receiveShadow
        scale={[1.45, 0.52, 0.82]}
      >
        <sphereGeometry
          args={[0.92, 32, 20, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58]}
        />
        <meshStandardMaterial
          color={FOLIAGE_COLORS.chloroplast}
          roughness={0.5}
          side={2}
        />
      </mesh>
      {/* Translucent stroma interior floor */}
      <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.15, 32]} />
        <meshStandardMaterial
          color={FOLIAGE_COLORS.stroma}
          opacity={stromaActive ? 0.72 : 0.45}
          roughness={0.45}
          transparent
        />
      </mesh>

      {/* Stacked thylakoid grana */}
      {Arr.map(GRANA_STACKS, (stack) => (
        <group key={stack.id} position={[stack.x, 0, stack.z]}>
          {Arr.map(THYLAKOID_Y, (y) => (
            <mesh castShadow key={`${stack.id}-${y}`} position={[0, y, 0]}>
              <cylinderGeometry args={[0.17, 0.17, 0.055, 20]} />
              <meshStandardMaterial
                color={
                  granaActive
                    ? FOLIAGE_COLORS.thylakoid
                    : FOLIAGE_COLORS.chloroplastInner
                }
                roughness={0.42}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Stromal lamella bridges connecting grana */}
      <mesh position={[-0.36, 0.36, 0.02]} rotation={[0, -0.5, 0]}>
        <boxGeometry args={[0.38, 0.03, 0.08]} />
        <meshStandardMaterial
          color={FOLIAGE_COLORS.thylakoid}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[0.06, 0.44, 0]} rotation={[0, 0.55, 0]}>
        <boxGeometry args={[0.42, 0.03, 0.08]} />
        <meshStandardMaterial
          color={FOLIAGE_COLORS.thylakoid}
          roughness={0.45}
        />
      </mesh>

      {/* Animated energy & metabolite carriers */}
      <group ref={shuttlesRef}>
        {/* Water input + Oxygen release near grana */}
        <mesh position={[-0.78, 0.52, 0.22]}>
          <sphereGeometry args={[0.052, 12, 10]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.waterMolecule}
            roughness={0.3}
          />
        </mesh>
        <mesh
          position={[-0.52, 0.84 + reading.photosynthesisRate * 0.14, -0.06]}
        >
          <sphereGeometry args={[0.058, 12, 10]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.oxygenBubble}
            roughness={0.28}
          />
        </mesh>
        {/* ATP & NADPH energy shuttles crossing to stroma */}
        <mesh position={[0.16, 0.62, 0.22]}>
          <octahedronGeometry args={[0.06, 0]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.atpGlow}
            roughness={0.32}
          />
        </mesh>
        <mesh position={[0.32, 0.54, 0.3]}>
          <octahedronGeometry args={[0.055, 0]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.nadphGlow}
            roughness={0.32}
          />
        </mesh>
        {/* CO2 entry & Glucose synthesis in stroma */}
        <mesh position={[0.74, 0.56, -0.18]}>
          <sphereGeometry args={[0.052, 12, 10]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.co2Molecule}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0.76, 0.34, 0.16]}>
          <cylinderGeometry args={[0.085, 0.085, 0.04, 6]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.glucoseRing}
            roughness={0.36}
          />
        </mesh>
      </group>

      {/* Labels */}
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[-0.58, 0.78, -0.1]}
      >
        <span>
          {parts.granum} ({parts.thylakoid})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0.68, 0.2, 0.42]}
      >
        <span>{parts.stroma}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[-0.86, 0.62, 0.34]}
      >
        <span>
          {parts.water} / {parts.oxygen}
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0.24, 0.82, 0.28]}
      >
        <span>
          {parts.atp} / {parts.nadph}
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0.88, 0.66, -0.06]}
      >
        <span>
          {parts.co2} / {parts.glucose}
        </span>
      </ThreeLabel>
    </group>
  );
}
