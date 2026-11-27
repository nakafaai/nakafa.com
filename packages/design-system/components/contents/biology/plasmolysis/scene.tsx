import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  ErythrocyteSpecimen,
  PlantCellWallCutaway,
  PlantProtoplast,
  SucroseBenchBeakers,
} from "@repo/design-system/components/contents/biology/plasmolysis/cells";
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
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { Array as Arr, Match } from "effect";
import { useCallback, useRef } from "react";
import type { Group } from "three";

const FLOW_DROPS = [0, 0.33, 0.66] as const;

function PlasmolysisCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [1.1, 1.58, 3.7] : [0.78, 1.32, 3.12]}
      cameraTarget={[0, 0.54, 0]}
      fov={38}
      maxDistance={6.2}
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
  const ink = useLabelInk();
  const innerRef = useRef<Group>(null);
  const flowRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluatePlasmolysis(cell, solution);

  const rewind = useCallback(() => {
    phaseRef.current = 0;
    if (innerRef.current !== null) {
      innerRef.current.scale.set(
        reading.innerScale,
        reading.innerScale,
        reading.innerScale
      );
    }
  }, [reading.innerScale]);
  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    const dt = simulationStep(delta);
    if (playing) {
      phaseRef.current += dt * 1.9;
    }
    if (innerRef.current !== null) {
      const pulse = playing ? Math.sin(phaseRef.current) * 0.022 : 0;
      const s = reading.innerScale + pulse;
      innerRef.current.scale.set(s, s, s);
    }
    if (flowRef.current !== null && playing) {
      Arr.forEach(flowRef.current.children, (child, idx) => {
        const t = (phaseRef.current * 0.4 + (FLOW_DROPS[idx] ?? 0)) % 1;
        const x = Match.value(reading.waterNet).pipe(
          Match.when("in", () => 1.02 - t * 0.42),
          Match.when("out", () => 0.6 + t * 0.42),
          Match.when(
            "balanced",
            () => 0.78 + Math.sin(phaseRef.current * 1.5 + idx) * 0.06
          ),
          Match.exhaustive
        );
        child.position.set(x, 0.56 + (idx - 1) * 0.14, 0.14);
      });
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <PlasmolysisCamera />
      <SucroseBenchBeakers solution={solution} />

      <group position={[0, 0.56, 0]}>
        {cell === "plant" ? (
          <>
            <PlantCellWallCutaway />
            <group
              ref={innerRef}
              scale={[
                reading.innerScale,
                reading.innerScale,
                reading.innerScale,
              ]}
            >
              <PlantProtoplast outcome={reading.outcome} />
            </group>
          </>
        ) : (
          <group
            ref={innerRef}
            scale={[reading.innerScale, reading.innerScale, reading.innerScale]}
          >
            <ErythrocyteSpecimen outcome={reading.outcome} />
          </group>
        )}

        {/* Osmotic water movement directional shaft & cone */}
        {reading.waterNet === "balanced" ? null : (
          <group
            position={[0.82, 0, 0.06]}
            rotation={[
              0,
              0,
              reading.waterNet === "in" ? Math.PI / 2 : -Math.PI / 2,
            ]}
          >
            <mesh position={[0, -0.07, 0]}>
              <cylinderGeometry args={[0.022, 0.022, 0.18, 14]} />
              <meshPhysicalMaterial
                clearcoat={0.85}
                color={HOMEOSTASIS_COLORS.waterArrow}
                roughness={0.2}
              />
            </mesh>
            <mesh position={[0, 0.06, 0]}>
              <coneGeometry args={[0.065, 0.14, 16]} />
              <meshPhysicalMaterial
                clearcoat={0.85}
                color={HOMEOSTASIS_COLORS.waterArrow}
                roughness={0.2}
              />
            </mesh>
          </group>
        )}
      </group>

      {/* Animated osmotic H2O droplets */}
      <group ref={flowRef}>
        {Arr.map(FLOW_DROPS, (offset, idx) => (
          <mesh
            key={offset}
            position={[0.74 + offset * 0.2, 0.56 + (idx - 1) * 0.14, 0.14]}
          >
            <sphereGeometry args={[0.028, 12, 10]} />
            <meshPhysicalMaterial
              clearcoat={1}
              color={HOMEOSTASIS_COLORS.waterArrow}
              opacity={0.82}
              roughness={0.12}
              transparent
            />
          </mesh>
        ))}
      </group>

      {/* Non-overlapping theme-aware labels */}
      {cell === "plant" ? (
        <ThreeLabel
          anchorX="right"
          color={ink}
          fontSize="compact"
          position={[-0.68, 1.08, 0]}
        >
          <span>{parts.cellWall}</span>
        </ThreeLabel>
      ) : null}
      <ThreeLabel color={ink} fontSize="compact" position={[0.06, 1.18, 0]}>
        <span>
          {parts.membrane} / {parts.cytoplasm}
        </span>
      </ThreeLabel>
      {cell === "plant" ? (
        <ThreeLabel
          anchorX="right"
          color={ink}
          fontSize="compact"
          position={[-0.72, 0.72, 0.24]}
        >
          <span>{parts.vacuole}</span>
        </ThreeLabel>
      ) : null}
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[0.88, 0.92, 0.08]}
      >
        <span>{parts.waterArrow}</span>
      </ThreeLabel>
    </group>
  );
}
