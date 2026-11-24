import { useFrame, useThree } from "@react-three/fiber";
import type {
  CellKind,
  Tonicity,
} from "@repo/design-system/components/contents/biology/plasmolysis/model";
import { evaluatePlasmolysis } from "@repo/design-system/components/contents/biology/plasmolysis/model";
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
import type { Group } from "three";

function PlasmolysisCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [1.5, 1.5, 3.1] : [1.2, 1.25, 2.45]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={5.6}
      minDistance={1.3}
    />
  );
}

export function PlasmolysisScene({
  cell,
  parts,
  solution,
}: {
  readonly cell: CellKind;
  readonly parts: Readonly<
    Record<
      "cellWall" | "cytoplasm" | "membrane" | "vacuole" | "waterArrow",
      string
    >
  >;
  readonly solution: Tonicity;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const innerRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluatePlasmolysis(cell, solution);

  useFrame((_, delta) => {
    if (innerRef.current === null) {
      return;
    }
    const dt = simulationStep(delta);
    if (playing) {
      phaseRef.current += dt * 2.1;
    }
    const pulse = playing ? Math.sin(phaseRef.current) * 0.025 : 0;
    const s = reading.innerScale + pulse;
    innerRef.current.scale.set(s, s, s);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <PlasmolysisCamera />
      <group position={[0, 0.56, 0]}>
        {cell === "plant" ? (
          <>
            {/* Rigid cellulose cell wall */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[1.18, 0.96, 0.96]} />
              <meshStandardMaterial
                color={HOMEOSTASIS_COLORS.cellWall}
                opacity={0.36}
                roughness={0.55}
                transparent
              />
            </mesh>
            {/* Plasma membrane + cytoplasm + central vacuole shrinking in hypertonic */}
            <group ref={innerRef}>
              <mesh>
                <boxGeometry args={[0.98, 0.78, 0.78]} />
                <meshStandardMaterial
                  color={HOMEOSTASIS_COLORS.membrane}
                  opacity={0.5}
                  roughness={0.42}
                  transparent
                />
              </mesh>
              <mesh>
                <sphereGeometry args={[0.34, 18, 14]} />
                <meshStandardMaterial
                  color={HOMEOSTASIS_COLORS.vacuole}
                  roughness={0.3}
                />
              </mesh>
            </group>
          </>
        ) : (
          /* Red blood cell biconcave disc */
          <group ref={innerRef}>
            <mesh castShadow scale={[1, 0.42, 1]}>
              <sphereGeometry args={[0.52, 24, 18]} />
              <meshStandardMaterial
                color={HOMEOSTASIS_COLORS.redBloodCell}
                opacity={reading.outcome === "haemolysed" ? 0.55 : 0.95}
                roughness={0.42}
                transparent
              />
            </mesh>
          </group>
        )}
        {/* Water movement indicator cone */}
        <mesh
          position={[0.88, 0, 0]}
          rotation={[
            0,
            0,
            reading.waterNet === "in" ? Math.PI / 2 : -Math.PI / 2,
          ]}
        >
          <coneGeometry args={[0.09, 0.28, 12]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.waterArrow}
            roughness={0.35}
          />
        </mesh>
      </group>
      {/* Labels */}
      {cell === "plant" ? (
        <ThreeLabel
          color={HOMEOSTASIS_COLORS.labelInk}
          fontSize="compact"
          position={[-0.78, 1.04, 0]}
        >
          <span>{parts.cellWall}</span>
        </ThreeLabel>
      ) : null}
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.12, 0]}
      >
        <span>
          {parts.membrane} / {parts.cytoplasm}
        </span>
      </ThreeLabel>
      {cell === "plant" ? (
        <ThreeLabel
          color={HOMEOSTASIS_COLORS.labelInk}
          fontSize="compact"
          position={[-0.78, 0.48, 0.34]}
        >
          <span>{parts.vacuole}</span>
        </ThreeLabel>
      ) : null}
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0.98, 0.84, 0]}
      >
        <span>{parts.waterArrow}</span>
      </ThreeLabel>
    </group>
  );
}
