import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { Substance } from "@repo/design-system/components/contents/biology/placenta/exchange";
import {
  particleX,
  transferMode,
} from "@repo/design-system/components/contents/biology/placenta/exchange";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Match } from "effect";
import { useRef, useState } from "react";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.86, 2.25];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.54, 0];
const PARTICLE_OFFSETS = [0, 0.25, 0.5, 0.75] as const;

export type PlacentaPart =
  | "placenta"
  | "cord"
  | "artery"
  | "vein"
  | "villus"
  | "capillary"
  | "maternal"
  | "wall"
  | "amnion"
  | "foetus";

/**
 * 3D placental exchange scene: left shows the foetus inside the amniotic sac
 * connected by the umbilical cord (2 arteries + 1 vein) to the placenta; right
 * magnifies a chorionic villus separating maternal blood pool and foetal
 * capillary while animating substance transport (or blocking blood cells).
 */
export function PlacentaScene({
  parts,
  substance,
}: {
  readonly parts: Readonly<Record<PlacentaPart, string>>;
  readonly substance: Substance;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const clock = useRef(0.35);
  const [phase, setPhase] = useState(0.35);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current = (clock.current + simulationStep(delta) * 0.4) % 1;
    setPhase(clock.current);
  });

  const mode = transferMode(substance);
  const particleColor = Match.value(substance).pipe(
    Match.when("oxygen", () => PLOT_COLORS.teal),
    Match.when("glucose", () => BIOLOGY_COLORS.glucose),
    Match.when("aminoAcids", () => PLOT_COLORS.violet),
    Match.when("antibodies", () => CELL_COLORS.antibody),
    Match.when("carbonDioxide", () => PLOT_COLORS.slate),
    Match.when("urea", () => BIOLOGY_COLORS.urea),
    Match.when("alcohol", () => PLOT_COLORS.orange),
    Match.when("bloodCells", () => BIOLOGY_COLORS.blood),
    Match.exhaustive
  );

  return (
    <group>
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[2.2, 0.04, 1.0]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.worktop}
          roughness={0.65}
        />
      </mesh>

      {/* Left: Amniotic sac, foetus, umbilical cord & discoid placenta */}
      <group position={[-0.6, 0.56, 0]}>
        <mesh>
          <sphereGeometry args={[0.38, 24, 24]} />
          <meshPhysicalMaterial
            color={LABORATORY_COLORS.water}
            opacity={0.28}
            roughness={0.15}
            transparent
          />
        </mesh>
        <mesh castShadow position={[-0.04, 0.02, 0]} rotation={[0, 0, 0.35]}>
          <capsuleGeometry args={[0.11, 0.16, 10, 18]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.tubule}
            roughness={0.55}
          />
        </mesh>
        {/* Umbilical cord connecting foetus to placenta */}
        <mesh position={[0.18, -0.08, 0]} rotation={[0, 0, 1.15]}>
          <cylinderGeometry args={[0.028, 0.028, 0.3, 14]} />
          <meshStandardMaterial color={PLOT_COLORS.pink} />
        </mesh>
        {/* Discoid placenta attached to uterine wall */}
        <mesh
          castShadow
          position={[0.34, -0.14, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.18, 0.18, 0.07, 22]} />
          <meshStandardMaterial color={BIOLOGY_COLORS.bloodDark} />
        </mesh>
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          gap={0.04}
          position={[-0.04, 0.42, 0]}
        >
          {parts.foetus}
        </ThreeLabel>
        <ThreeLabel
          anchorY="top"
          color={ink}
          gap={0.04}
          position={[0.34, -0.36, 0]}
        >
          {parts.placenta}
        </ThreeLabel>
      </group>

      {/* Right: Magnified chorionic villus exchange chamber */}
      <group position={[0.42, 0.56, 0]}>
        {/* Maternal blood sinusoid (left half) */}
        <mesh position={[-0.28, 0, -0.04]}>
          <boxGeometry args={[0.52, 0.68, 0.24]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.blood}
            opacity={0.35}
            transparent
          />
        </mesh>
        {/* Thin single-cell chorionic villus wall separating blood supplies */}
        <mesh castShadow position={[0, 0, 0]}>
          <boxGeometry args={[0.05, 0.72, 0.28]} />
          <meshStandardMaterial color={CELL_COLORS.membrane} roughness={0.5} />
        </mesh>
        {/* Foetal capillary inside villus (right half) */}
        <mesh position={[0.28, 0, -0.04]}>
          <boxGeometry args={[0.52, 0.68, 0.24]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.bloodDark}
            opacity={0.35}
            transparent
          />
        </mesh>

        {/* Moving substance particles */}
        {Arr.map(PARTICLE_OFFSETS, (offset) => {
          const x = particleX(mode, phase + offset);
          const y = -0.21 + offset * 0.56;
          return (
            <mesh castShadow key={offset} position={[x, y, 0.16]}>
              <sphereGeometry
                args={[substance === "bloodCells" ? 0.058 : 0.036, 16, 16]}
              />
              <meshStandardMaterial color={particleColor} />
            </mesh>
          );
        })}

        <ThreeLabel
          anchorY="bottom"
          color={ink}
          gap={0.04}
          position={[-0.28, 0.4, 0]}
        >
          {parts.maternal}
        </ThreeLabel>
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          gap={0.04}
          position={[0, 0.44, 0]}
        >
          {parts.villus}
        </ThreeLabel>
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          gap={0.04}
          position={[0.28, 0.4, 0]}
        >
          {parts.capillary}
        </ThreeLabel>
      </group>
    </group>
  );
}
