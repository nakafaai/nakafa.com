import { useFrame, useThree } from "@react-three/fiber";
import type { CultureSolution } from "@repo/design-system/components/contents/biology/mineral/model";
import { evaluateCultureGrowth } from "@repo/design-system/components/contents/biology/mineral/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr, Match } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function MineralCamera() {
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

function leafTint(solution: CultureSolution): string {
  return Match.value(solution).pipe(
    Match.when("complete", () => BOTANY_COLORS.healthyLeaf),
    Match.when("noNitrogen", () => BOTANY_COLORS.chlorosisYellow),
    Match.when("noPhosphorus", () => BOTANY_COLORS.phosphorusPurple),
    Match.when("noPotassium", () => BOTANY_COLORS.necrosisEdge),
    Match.when("noMagnesium", () => BOTANY_COLORS.mgInterveinal),
    Match.exhaustive
  );
}

export function MineralDeficiencyScene({
  parts,
  solution,
}: {
  readonly parts: Readonly<
    Record<"airTube" | "leaf" | "root" | "solution" | "stem", string>
  >;
  readonly solution: CultureSolution;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const bubbleRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const growth = evaluateCultureGrowth(solution);
  const leafColor = leafTint(solution);

  const roots = useMemo(
    () =>
      Arr.makeBy(5, (index) => ({
        angle: -0.45 + index * 0.22,
        id: `r-${index}`,
        offset: -0.12 + index * 0.06,
      })),
    []
  );

  useFrame((_, delta) => {
    if (!playing || bubbleRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.6;
    const t = phaseRef.current % 1;
    bubbleRef.current.position.set(0.22, 0.14 + t * 0.44, 0.04);
  });

  const stemH = 0.62 * growth.stemHeight;
  const leafR = 0.2 * growth.leafScale;
  const rootH = 0.36 * growth.rootLength;

  return (
    <group>
      <SimulationTicker running={playing} />
      <MineralCamera />
      {/* Culture jar wrapped to block algae */}
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.38, 0.36, 0.72, 24]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.glassJar}
          opacity={0.32}
          roughness={0.2}
          transparent
        />
      </mesh>
      {/* Knop's nutrient solution */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.34, 0.33, 0.52, 24]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.waterBlue}
          opacity={0.48}
          roughness={0.18}
          transparent
        />
      </mesh>
      {/* Cotton bung at neck */}
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.37, 0.35, 0.08, 20]} />
        <meshStandardMaterial color={BOTANY_COLORS.rootIvory} roughness={0.8} />
      </mesh>
      {/* Aeration tube */}
      <mesh position={[0.22, 0.56, 0.04]}>
        <cylinderGeometry args={[0.022, 0.022, 0.88, 12]} />
        <meshStandardMaterial color={BOTANY_COLORS.glassJar} roughness={0.3} />
      </mesh>
      {/* Rising air bubble */}
      <group position={[0.22, 0.26, 0.04]} ref={bubbleRef}>
        <mesh>
          <sphereGeometry args={[0.032, 10, 10]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.cohesionCyan}
            roughness={0.15}
          />
        </mesh>
      </group>
      {/* Submerged root cluster */}
      {Arr.map(roots, (strand) => (
        <mesh
          key={strand.id}
          position={[strand.offset, 0.62 - rootH * 0.5, 0]}
          rotation={[0, 0, strand.angle]}
        >
          <cylinderGeometry args={[0.014, 0.008, rootH, 8]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.rootIvory}
            roughness={0.7}
          />
        </mesh>
      ))}
      {/* Stem */}
      <mesh castShadow position={[0, 0.74 + stemH * 0.5, 0]}>
        <cylinderGeometry args={[0.032, 0.042, stemH, 12]} />
        <meshStandardMaterial
          color={
            solution === "noNitrogen"
              ? BOTANY_COLORS.chlorosisYellow
              : BOTANY_COLORS.stemGreen
          }
          roughness={0.55}
        />
      </mesh>
      {/* Paired leaves */}
      <mesh
        castShadow
        position={[-leafR * 0.9, 0.78 + stemH * 0.82, 0]}
        rotation={[0.2, 0, 0.45]}
        scale={[1.4, 0.28, 0.75]}
      >
        <sphereGeometry args={[leafR, 14, 12]} />
        <meshStandardMaterial color={leafColor} roughness={0.5} />
      </mesh>
      <mesh
        castShadow
        position={[leafR * 0.9, 0.74 + stemH * 0.68, 0.06]}
        rotation={[-0.15, 0, -0.45]}
        scale={[1.35, 0.28, 0.72]}
      >
        <sphereGeometry args={[leafR, 14, 12]} />
        <meshStandardMaterial color={leafColor} roughness={0.5} />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.65, 1.24, 0]}
      >
        <span>{parts.leaf}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.56, 0.94, 0]}
      >
        <span>{parts.stem}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.68, 0.46, 0]}
      >
        <span>{parts.root}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.66, 0.3, 0]}
      >
        <span>{parts.solution}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.66, 0.92, 0]}
      >
        <span>{parts.airTube}</span>
      </ThreeLabel>
    </group>
  );
}
