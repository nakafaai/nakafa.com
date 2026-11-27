import { useFrame, useThree } from "@react-three/fiber";
import { useWalnutTexture } from "@repo/design-system/components/contents/biology/botany";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { MonohybridCross } from "@repo/design-system/components/contents/biology/monohybrid/model";
import { evaluateMonohybridCross } from "@repo/design-system/components/contents/biology/monohybrid/model";
import { PeaPlantPot } from "@repo/design-system/components/contents/biology/monohybrid/plant";
import { BiologyBenchSurface } from "@repo/design-system/components/contents/biology/workbench";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const TRAY_FEET = [
  [-0.76, -0.58],
  [0.76, -0.58],
  [-0.76, 0.58],
  [0.76, 0.58],
] as const;

function MonohybridCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.98, 4.05] : [0, 1.7, 3.48]}
      cameraTarget={[0, 0.52, 0]}
      fov={38}
      maxDistance={6.6}
      minDistance={1.4}
    />
  );
}

/** Turned brass and glowing glass gamete medallion seated beside a Punnett row or column. */
function GameteMedallion({
  color,
  position,
}: {
  readonly color: string;
  readonly position: readonly [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.09, 0.098, 0.04, 24]} />
        <MetalMaterial color={GENETICS_COLORS.brassPolished} roughness={0.28} />
      </mesh>
      <mesh castShadow position={[0, 0.056, 0]}>
        <sphereGeometry args={[0.068, 20, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.78}
          color={color}
          emissive={color}
          emissiveIntensity={0.18}
          roughness={0.22}
        />
      </mesh>
    </group>
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
  const invalidate = useThree((state) => state.invalidate);
  const ink = useLabelInk();
  const walnutTex = useWalnutTexture();
  const swayRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const outcome = evaluateMonohybridCross(cross);

  const rewind = () => {
    phaseRef.current = 0;
    if (swayRef.current !== null) {
      swayRef.current.rotation.set(0, 0, 0);
    }
    invalidate();
  };

  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || swayRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.4;
    swayRef.current.rotation.z = Math.sin(phaseRef.current) * 0.025;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <MonohybridCamera />
      <BiologyBenchSurface radius={14} y={0} />

      {/* Engraved walnut-and-brass 2x2 Punnett specimen tray */}
      <group>
        {Arr.map(TRAY_FEET, ([fx, fz]) => (
          <mesh castShadow key={`${fx}-${fz}`} position={[fx, 0.015, fz]}>
            <cylinderGeometry args={[0.042, 0.048, 0.03, 22]} />
            <MetalMaterial
              color={GENETICS_COLORS.brassPolished}
              roughness={0.28}
            />
          </mesh>
        ))}
        <mesh castShadow position={[0, 0.075, 0]} receiveShadow>
          <boxGeometry args={[1.76, 0.095, 1.38]} />
          <meshPhysicalMaterial
            clearcoat={0.34}
            clearcoatRoughness={0.36}
            color={
              walnutTex === null
                ? GENETICS_COLORS.walnutWarm
                : getColor("WHITE")
            }
            map={walnutTex}
            roughness={0.5}
          />
        </mesh>
        {/* Brass 2x2 cross dividers */}
        <mesh position={[0, 0.128, 0]}>
          <boxGeometry args={[0.018, 0.018, 1.32]} />
          <MetalMaterial
            color={GENETICS_COLORS.brassPolished}
            roughness={0.26}
          />
        </mesh>
        <mesh position={[0, 0.128, 0]}>
          <boxGeometry args={[1.7, 0.018, 0.018]} />
          <MetalMaterial
            color={GENETICS_COLORS.brassPolished}
            roughness={0.26}
          />
        </mesh>
        {/* Brass front trim */}
        <mesh position={[0, 0.126, 0.675]}>
          <boxGeometry args={[1.74, 0.012, 0.018]} />
          <MetalMaterial
            color={GENETICS_COLORS.brassPolished}
            roughness={0.26}
          />
        </mesh>
      </group>

      {/* Four potted Pisum sativum pea plants in the 2x2 Punnett quadrants */}
      <group ref={swayRef}>
        {Arr.map(outcome.cells, (cell, idx) => {
          const x = cell.col === 0 ? -0.4 : 0.4;
          const z = cell.row === 0 ? -0.3 : 0.3;
          const vineHeight = cell.tall ? 0.56 : 0.22;
          return (
            <group key={cell.id} position={[x, 0.122, z]}>
              <PeaPlantPot
                height={vineHeight}
                position={[0, 0, 0]}
                seed={idx + 3}
                tall={cell.tall}
              />
              <ThreeLabel
                anchorY="bottom"
                color={ink}
                fontSize="compact"
                position={[
                  cell.row === 0 ? -0.14 : 0.14,
                  0.17 + vineHeight + 0.14,
                  0,
                ]}
              >
                <span>{cell.genotype}</span>
              </ThreeLabel>
            </group>
          );
        })}
      </group>

      {/* Turned brass gamete medallions along top and left borders */}
      <GameteMedallion
        color={GENETICS_COLORS.gameteCyan}
        position={[-0.4, 0, -0.88]}
      />
      <GameteMedallion
        color={GENETICS_COLORS.gameteCyan}
        position={[0.4, 0, -0.88]}
      />
      <GameteMedallion
        color={GENETICS_COLORS.carrierAmber}
        position={[-1.08, 0, -0.3]}
      />
      <GameteMedallion
        color={GENETICS_COLORS.carrierAmber}
        position={[-1.08, 0, 0.3]}
      />

      {/* Adaptive-ink labels */}
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[0, 1.18, -0.78]}
      >
        <span>
          {parts.parentA} ({outcome.parentAGametes[0]},{" "}
          {outcome.parentAGametes[1]})
        </span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[-1.08, 0.34, 0.18]}
      >
        <span>
          {parts.parentB} ({outcome.parentBGametes[0]},{" "}
          {outcome.parentBGametes[1]})
        </span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[1.04, 0.96, -0.22]}
      >
        <span>{parts.tallPea}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[1.04, 0.44, 0.36]}
      >
        <span>{outcome.tallCount < 4 ? parts.dwarfPea : parts.gamete}</span>
      </ThreeLabel>
    </group>
  );
}
