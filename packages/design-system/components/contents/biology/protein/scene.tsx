import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  Condition,
  Level,
} from "@repo/design-system/components/contents/biology/protein/folding";
import { polypeptideBeads } from "@repo/design-system/components/contents/biology/protein/folding";
import {
  buildStabilisingBonds,
  buildSubunitChains,
  DenaturationEnvironment,
  HaemProstheticGroup,
  QUATERNARY_HAEMS,
  SUBUNIT_COLORS,
  SubunitRibbon,
} from "@repo/design-system/components/contents/biology/protein/structure";
import {
  MolecularStick,
  SlideStage,
} from "@repo/design-system/components/contents/biology/workbench";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.9, 2.35];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.58, 0];

/**
 * 3D polypeptide workbench morphing across primary chain, secondary alpha-helix
 * and pleated beta-sheet with hydrogen bonds, tertiary globule with disulfide
 * bridges and porphyrin haem, and quaternary 4-subunit haemoglobin, plus
 * thermal and acidic denaturation.
 */
export function ProteinScene({
  condition,
  level,
  parts,
}: {
  readonly condition: Condition;
  readonly level: Level;
  readonly parts: Readonly<
    Record<"chain" | "helix" | "sheet" | "haem", string>
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const ink = useLabelInk();
  const rootRef = useRef<Group>(null);
  const clock = useRef(0);

  const beads = useMemo(
    () => polypeptideBeads(level, condition),
    [condition, level]
  );
  const subunitChains = useMemo(
    () => buildSubunitChains(beads, level, condition),
    [beads, condition, level]
  );
  const hBondPairs = useMemo(
    () => buildStabilisingBonds(beads, level, condition),
    [beads, condition, level]
  );

  const rewind = () => {
    clock.current = 0;
    if (rootRef.current !== null) {
      rootRef.current.rotation.set(0, 0, 0);
      rootRef.current.position.set(0, 0, 0);
    }
    invalidate();
  };

  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || rootRef.current === null) {
      return;
    }
    clock.current += simulationStep(delta);
    if (condition === "normal") {
      rootRef.current.rotation.y = Math.sin(clock.current * 0.65) * 0.35;
      rootRef.current.position.y = 0;
    } else {
      rootRef.current.rotation.y = Math.sin(clock.current * 4.5) * 0.05;
      rootRef.current.position.y = Math.sin(clock.current * 10) * 0.016;
    }
  });

  const isNormal = condition === "normal";
  const showHaem = isNormal && (level === "tertiary" || level === "quaternary");
  const isTertiary = level === "tertiary";
  const ribbonRadius = level === "primary" || !isNormal ? 0.022 : 0.036;
  const bondColor = isTertiary
    ? GENETICS_COLORS.disulfideGold
    : GENETICS_COLORS.hBondCyan;

  return (
    <group>
      <SimulationTicker running={playing} />
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      <SlideStage position={[0, 0, 0]} radius={0.96} />

      <group ref={rootRef}>
        {Arr.map(subunitChains, (chain) => (
          <SubunitRibbon
            color={chain.color}
            key={`chain-${chain.subunit}`}
            points={chain.points}
            radius={ribbonRadius}
          />
        ))}

        {Arr.map(beads, (bead, idx) => (
          <mesh castShadow key={bead.id} position={bead.position}>
            <sphereGeometry
              args={[level === "primary" ? 0.054 : 0.044, 18, 16]}
            />
            <meshPhysicalMaterial
              clearcoat={0.72}
              clearcoatRoughness={0.2}
              color={
                SUBUNIT_COLORS[bead.subunit % SUBUNIT_COLORS.length] ??
                PLOT_COLORS.teal
              }
              roughness={0.28 + (idx % 3) * 0.05}
            />
          </mesh>
        ))}

        {Arr.map(hBondPairs, (bond) => (
          <MolecularStick
            color={bondColor}
            emissive={bondColor}
            emissiveIntensity={0.4}
            end={bond.end}
            key={bond.id}
            opacity={isTertiary ? 1 : 0.72}
            radius={isTertiary ? 0.014 : 0.008}
            start={bond.start}
          />
        ))}

        {showHaem && isTertiary ? (
          <HaemProstheticGroup position={[0, 0.58, 0.04]} scale={1.15} />
        ) : null}
        {showHaem && level === "quaternary"
          ? Arr.map(QUATERNARY_HAEMS, (pos) => (
              <HaemProstheticGroup
                key={`haem-${pos[0]}-${pos[1]}-${pos[2]}`}
                position={pos}
                scale={0.85}
              />
            ))
          : null}

        <DenaturationEnvironment condition={condition} />
      </group>

      {isNormal && level === "primary" ? (
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          fontSize="compact"
          gap={0.04}
          position={[0, 0.76, 0]}
        >
          {parts.chain}
        </ThreeLabel>
      ) : null}
      {isNormal && level === "secondary" ? (
        <group>
          <ThreeLabel
            anchorY="bottom"
            color={ink}
            fontSize="compact"
            gap={0.04}
            position={[-0.45, 0.9, 0]}
          >
            {parts.helix}
          </ThreeLabel>
          <ThreeLabel
            anchorY="bottom"
            color={ink}
            fontSize="compact"
            gap={0.04}
            position={[0.48, 0.9, 0]}
          >
            {parts.sheet}
          </ThreeLabel>
        </group>
      ) : null}
      {showHaem ? (
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          fontSize="compact"
          gap={0.04}
          position={[0, 1.04, 0]}
        >
          {parts.haem}
        </ThreeLabel>
      ) : null}
    </group>
  );
}
