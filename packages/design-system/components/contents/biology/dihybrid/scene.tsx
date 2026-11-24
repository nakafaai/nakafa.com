import { useFrame, useThree } from "@react-three/fiber";
import type { DihybridFilter } from "@repo/design-system/components/contents/biology/dihybrid/model";
import { evaluateDihybridGrid } from "@repo/design-system/components/contents/biology/dihybrid/model";
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

function DihybridCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 2.05, 3.2] : [0, 1.85, 2.65]}
      cameraTarget={[0, 0.25, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.5}
    />
  );
}

export function DihybridCrossScene({
  filter,
  parts,
}: {
  readonly filter: DihybridFilter;
  readonly parts: Readonly<
    Record<
      "roundGreen" | "roundYellow" | "wrinkledGreen" | "wrinkledYellow",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const gridRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const cells = evaluateDihybridGrid(filter);

  useFrame((_, delta) => {
    if (!playing || gridRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.45;
    gridRef.current.rotation.y = Math.sin(phaseRef.current) * 0.22;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <DihybridCamera />
      <group ref={gridRef}>
        {/* 4x4 Punnett tray */}
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[1.9, 0.1, 1.9]} />
          <meshStandardMaterial
            color={GENETICS_COLORS.boardSlate}
            roughness={0.65}
          />
        </mesh>
        {/* 16 pea seeds: smooth spheres (round) vs dodecahedrons (wrinkled) */}
        {Arr.map(cells, (cell) => {
          const x = -0.63 + cell.col * 0.42;
          const z = -0.63 + cell.row * 0.42;
          const isYellow =
            cell.phenotype === "roundYellow" ||
            cell.phenotype === "wrinkledYellow";
          const isRound =
            cell.phenotype === "roundYellow" || cell.phenotype === "roundGreen";
          const y = cell.highlighted ? 0.28 : 0.2;
          return (
            <mesh castShadow key={cell.id} position={[x, y, z]}>
              {isRound ? (
                <sphereGeometry args={[0.125, 16, 14]} />
              ) : (
                <dodecahedronGeometry args={[0.125, 0]} />
              )}
              <meshStandardMaterial
                color={
                  isYellow
                    ? GENETICS_COLORS.peaYellow
                    : GENETICS_COLORS.peaGreen
                }
                opacity={cell.highlighted ? 1 : 0.25}
                roughness={isRound ? 0.3 : 0.72}
                transparent={!cell.highlighted}
              />
            </mesh>
          );
        })}
      </group>
      {/* Corner legend labels */}
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[-1.08, 0.56, -0.78]}
      >
        <span>{parts.roundYellow}</span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[1.08, 0.56, -0.78]}
      >
        <span>{parts.roundGreen}</span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[-1.08, 0.56, 0.78]}
      >
        <span>{parts.wrinkledYellow}</span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[1.08, 0.56, 0.78]}
      >
        <span>{parts.wrinkledGreen}</span>
      </ThreeLabel>
    </group>
  );
}
