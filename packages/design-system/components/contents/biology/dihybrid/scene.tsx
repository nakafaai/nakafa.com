import { useFrame, useThree } from "@react-three/fiber";
import {
  PeaPodHalf,
  PeaSeed,
  useWalnutTexture,
} from "@repo/design-system/components/contents/biology/botany";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { DihybridFilter } from "@repo/design-system/components/contents/biology/dihybrid/model";
import { evaluateDihybridGrid } from "@repo/design-system/components/contents/biology/dihybrid/model";
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

const DIVIDER_POSITIONS = [-0.42, 0, 0.42] as const;

const CORNER_FEET = [
  [-0.84, -0.84],
  [0.84, -0.84],
  [-0.84, 0.84],
  [0.84, 0.84],
] as const;

function DihybridCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 2.28, 3.62] : [0, 1.98, 3.05]}
      cameraTarget={[0, 0.24, 0.05]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.5}
    />
  );
}

/** Heirloom walnut-and-brass 4x4 Punnett botanical sorting tray with recessed seed wells. */
function BotanicalPunnettTray() {
  const walnutTex = useWalnutTexture();

  return (
    <group>
      {/* Turned brass feet lifting the walnut tray cleanly off the bench */}
      {Arr.map(CORNER_FEET, ([fx, fz]) => (
        <mesh castShadow key={`${fx}-${fz}`} position={[fx, 0.015, fz]}>
          <cylinderGeometry args={[0.045, 0.052, 0.03, 24]} />
          <MetalMaterial
            color={GENETICS_COLORS.brassPolished}
            roughness={0.28}
          />
        </mesh>
      ))}

      {/* Main oiled walnut board */}
      <mesh castShadow position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[1.92, 0.1, 1.92]} />
        <meshPhysicalMaterial
          clearcoat={0.34}
          clearcoatRoughness={0.36}
          color={
            walnutTex === null ? GENETICS_COLORS.walnutWarm : getColor("WHITE")
          }
          map={walnutTex}
          roughness={0.5}
        />
      </mesh>

      {/* Raised walnut & brass perimeter frame rails */}
      {Arr.map([-0.94, 0.94] as const, (offset) => (
        <group key={`rail-${offset}`}>
          <mesh castShadow position={[0, 0.145, offset]} receiveShadow>
            <boxGeometry args={[1.96, 0.036, 0.064]} />
            <meshPhysicalMaterial
              clearcoat={0.32}
              color={GENETICS_COLORS.walnutDark}
              roughness={0.48}
            />
          </mesh>
          <mesh castShadow position={[offset, 0.145, 0]} receiveShadow>
            <boxGeometry args={[0.064, 0.036, 1.84]} />
            <meshPhysicalMaterial
              clearcoat={0.32}
              color={GENETICS_COLORS.walnutDark}
              roughness={0.48}
            />
          </mesh>
        </group>
      ))}

      {/* Inlaid brushed brass 4x4 Punnett grid dividers */}
      {Arr.map(DIVIDER_POSITIONS, (pos) => (
        <group key={`div-${pos}`}>
          <mesh position={[pos, 0.136, 0]}>
            <boxGeometry args={[0.014, 0.018, 1.82]} />
            <MetalMaterial
              color={GENETICS_COLORS.brassPolished}
              roughness={0.26}
            />
          </mesh>
          <mesh position={[0, 0.136, pos]}>
            <boxGeometry args={[1.82, 0.018, 0.014]} />
            <MetalMaterial
              color={GENETICS_COLORS.brassPolished}
              roughness={0.26}
            />
          </mesh>
        </group>
      ))}
    </group>
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
  const invalidate = useThree((state) => state.invalidate);
  const ink = useLabelInk();
  const gridRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const cells = evaluateDihybridGrid(filter);

  const rewind = () => {
    phaseRef.current = 0;
    if (gridRef.current !== null) {
      gridRef.current.rotation.set(0, 0, 0);
    }
    invalidate();
  };

  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || gridRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.45;
    gridRef.current.rotation.y = Math.sin(phaseRef.current) * 0.2;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <DihybridCamera />

      <group ref={gridRef}>
        <BotanicalPunnettTray />

        {/* 16 sculpted Pisum sativum pea seeds resting in brass dish bezels */}
        {Arr.map(cells, (cell, idx) => {
          const x = -0.63 + cell.col * 0.42;
          const z = -0.63 + cell.row * 0.42;
          const isYellow =
            cell.phenotype === "roundYellow" ||
            cell.phenotype === "wrinkledYellow";
          const isWrinkled =
            cell.phenotype === "wrinkledYellow" ||
            cell.phenotype === "wrinkledGreen";
          const y = cell.highlighted ? 0.26 : 0.22;
          return (
            <group key={cell.id}>
              {/* Turned brass dish bezel inside each Punnett cell */}
              <mesh
                position={[x, 0.136, z]}
                receiveShadow
                rotation={[Math.PI / 2, 0, 0]}
              >
                <torusGeometry args={[0.135, 0.008, 10, 28]} />
                <MetalMaterial
                  color={
                    cell.highlighted
                      ? GENETICS_COLORS.brassPolished
                      : GENETICS_COLORS.brassDark
                  }
                  roughness={0.3}
                />
              </mesh>
              <PeaSeed
                highlighted={cell.highlighted}
                isWrinkled={isWrinkled}
                isYellow={isYellow}
                position={[x, y, z]}
                scale={cell.highlighted ? 1.04 : 0.9}
                seed={idx + 5}
              />
            </group>
          );
        })}

        {/* Open botanical Pisum sativum pod half resting alongside the tray */}
        <PeaPodHalf position={[0, 0.11, 1.24]} rotation={[0.16, 0.14, 0]} />
      </group>

      {/* Well-framed non-clipping adaptive-ink legend labels */}
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[-0.76, 0.56, -0.82]}
      >
        <span>{parts.roundYellow}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[0.76, 0.56, -0.82]}
      >
        <span>{parts.roundGreen}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        position={[-0.78, 0.24, 1.08]}
      >
        <span>{parts.wrinkledYellow}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        position={[0.78, 0.24, 1.08]}
      >
        <span>{parts.wrinkledGreen}</span>
      </ThreeLabel>
    </group>
  );
}
