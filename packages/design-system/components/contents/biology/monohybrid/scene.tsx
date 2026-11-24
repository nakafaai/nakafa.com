import { useFrame, useThree } from "@react-three/fiber";
import type { MonohybridCross } from "@repo/design-system/components/contents/biology/monohybrid/model";
import { evaluateMonohybridCross } from "@repo/design-system/components/contents/biology/monohybrid/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

function MonohybridCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.75, 3.45] : [0, 1.45, 2.85]}
      cameraTarget={[0, 0.52, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function MonohybridCrossScene({
  cross,
  parts,
}: {
  readonly cross: MonohybridCross;
  readonly parts: Readonly<
    Record<"dwarfPea" | "gamete" | "parentA" | "parentB" | "tallPea", string>
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const pulseRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const outcome = evaluateMonohybridCross(cross);

  useFrame((_, delta) => {
    if (!playing || pulseRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 2;
    const s = 1 + Math.sin(phaseRef.current) * 0.04;
    pulseRef.current.scale.set(1, s, 1);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <MonohybridCamera />
      {/* 2x2 Punnett board slab */}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[1.65, 0.1, 1.25]} />
        <meshStandardMaterial
          color={GENETICS_COLORS.boardSlate}
          roughness={0.65}
        />
      </mesh>
      {/* Offspring pea plants seated in 2x2 Punnett quadrants */}
      <group ref={pulseRef}>
        {Arr.map(outcome.cells, (cell) => {
          const x = cell.col === 0 ? -0.36 : 0.36;
          const z = cell.row === 0 ? -0.26 : 0.26;
          const height = cell.tall ? 0.68 : 0.28;
          return (
            <group key={cell.id} position={[x, 0.13, z]}>
              <mesh castShadow position={[0, height * 0.5, 0]}>
                <cylinderGeometry args={[0.036, 0.044, height, 12]} />
                <meshStandardMaterial
                  color={
                    cell.tall
                      ? GENETICS_COLORS.tallLeaf
                      : GENETICS_COLORS.dwarfLeaf
                  }
                  roughness={0.5}
                />
              </mesh>
              <mesh castShadow position={[0, height + 0.06, 0]}>
                <sphereGeometry args={[0.11, 14, 12]} />
                <meshStandardMaterial
                  color={
                    cell.tall
                      ? GENETICS_COLORS.tallLeaf
                      : GENETICS_COLORS.peaYellow
                  }
                  roughness={0.45}
                />
              </mesh>
              <ThreeLabel
                color={GENETICS_COLORS.labelInk}
                fontSize="compact"
                position={[0, height + 0.22, 0]}
              >
                <span>{cell.genotype}</span>
              </ThreeLabel>
            </group>
          );
        })}
      </group>
      {/* Gamete spheres along top and left borders */}
      <mesh position={[-0.36, 0.2, -0.78]}>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshStandardMaterial
          color={GENETICS_COLORS.gameteCyan}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0.36, 0.2, -0.78]}>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshStandardMaterial
          color={GENETICS_COLORS.gameteCyan}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[-0.98, 0.2, -0.26]}>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshStandardMaterial
          color={GENETICS_COLORS.carrierAmber}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[-0.98, 0.2, 0.26]}>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshStandardMaterial
          color={GENETICS_COLORS.carrierAmber}
          roughness={0.35}
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.36, -0.92]}
      >
        <span>
          {parts.parentA} ({outcome.parentAGametes[0]},{" "}
          {outcome.parentAGametes[1]})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[-1.08, 0.44, 0]}
      >
        <span>
          {parts.parentB} ({outcome.parentBGametes[0]},{" "}
          {outcome.parentBGametes[1]})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0.98, 0.88, -0.2]}
      >
        <span>{parts.tallPea}</span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0.98, 0.34, 0.36]}
      >
        <span>{outcome.tallCount < 4 ? parts.dwarfPea : parts.gamete}</span>
      </ThreeLabel>
    </group>
  );
}
