import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { Kind } from "@repo/design-system/components/contents/biology/twins/split";
import { twinOutcome } from "@repo/design-system/components/contents/biology/twins/split";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { useRef } from "react";
import type { Group } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.85, 2.25];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.56, 0];

export type TwinsPart =
  | "ovary"
  | "oocyte"
  | "sperm"
  | "blastocyst"
  | "innerCellMass"
  | "disc"
  | "placenta"
  | "amnion"
  | "chorion"
  | "foetus";

/**
 * 3D twin development scene: left shows two independent oocytes + sperm
 * (fraternal) or one embryo splitting at the selected day (identical); right
 * shows the two foetuses inside the exact number of placentas and amniotic sacs
 * (or conjoined past day 12).
 */
export function TwinsScene({
  kind,
  parts,
  splitDay,
}: {
  readonly kind: Kind;
  readonly parts: Readonly<Record<TwinsPart, string>>;
  readonly splitDay: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const rootRef = useRef<Group>(null);
  const clock = useRef(0);

  useFrame((_, delta) => {
    if (!playing || rootRef.current === null) {
      return;
    }
    clock.current += simulationStep(delta);
    rootRef.current.rotation.y = Math.sin(clock.current * 0.65) * 0.24;
  });

  const outcome = twinOutcome(kind, splitDay);
  const foetusOffset = outcome.joined ? 0.08 : 0.22;

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

      <group ref={rootRef}>
        {/* Left: Fertilisation / embryo split origin */}
        <group position={[-0.64, 0.56, 0]}>
          {kind === "fraternal" ? (
            <group>
              <mesh castShadow position={[0, 0.16, 0]}>
                <sphereGeometry args={[0.12, 20, 20]} />
                <meshStandardMaterial color={PLOT_COLORS.teal} />
              </mesh>
              <mesh castShadow position={[0, -0.16, 0]}>
                <sphereGeometry args={[0.12, 20, 20]} />
                <meshStandardMaterial color={PLOT_COLORS.violet} />
              </mesh>
              <ThreeLabel
                anchorY="bottom"
                color={ink}
                gap={0.04}
                position={[0, 0.34, 0]}
              >
                {parts.oocyte}
              </ThreeLabel>
            </group>
          ) : (
            <group>
              <mesh>
                <sphereGeometry args={[0.2, 22, 22]} />
                <meshPhysicalMaterial
                  color={LABORATORY_COLORS.polystyrene}
                  opacity={0.35}
                  transparent
                />
              </mesh>
              <mesh castShadow position={[-0.06, 0.03, 0]}>
                <sphereGeometry args={[0.075, 16, 16]} />
                <meshStandardMaterial color={PLOT_COLORS.teal} />
              </mesh>
              <mesh castShadow position={[0.06, -0.03, 0]}>
                <sphereGeometry args={[0.075, 16, 16]} />
                <meshStandardMaterial color={PLOT_COLORS.teal} />
              </mesh>
              <ThreeLabel
                anchorY="bottom"
                color={ink}
                gap={0.04}
                position={[0, 0.28, 0]}
              >
                {splitDay >= 9 ? parts.disc : parts.blastocyst}
              </ThreeLabel>
            </group>
          )}
        </group>

        {/* Right: Uterine membranes, placentas, amniotic sacs & foetuses */}
        <group position={[0.38, 0.56, 0]}>
          {/* Placentas (1 shared wide placenta vs 2 separate placentas) */}
          {outcome.placentas === 1 ? (
            <mesh castShadow position={[0, -0.34, 0]}>
              <cylinderGeometry args={[0.36, 0.36, 0.08, 26]} />
              <meshStandardMaterial color={BIOLOGY_COLORS.bloodDark} />
            </mesh>
          ) : (
            <group>
              <mesh castShadow position={[-0.24, -0.34, 0]}>
                <cylinderGeometry args={[0.18, 0.18, 0.08, 22]} />
                <meshStandardMaterial color={BIOLOGY_COLORS.bloodDark} />
              </mesh>
              <mesh castShadow position={[0.24, -0.34, 0]}>
                <cylinderGeometry args={[0.18, 0.18, 0.08, 22]} />
                <meshStandardMaterial color={BIOLOGY_COLORS.bloodDark} />
              </mesh>
            </group>
          )}

          {/* Amniotic sacs (1 shared vs 2 separate) */}
          {outcome.sacs === 1 ? (
            <mesh position={[0, 0.02, 0]} scale={[1.35, 1, 0.9]}>
              <sphereGeometry args={[0.32, 24, 24]} />
              <meshPhysicalMaterial
                color={LABORATORY_COLORS.water}
                opacity={0.28}
                transparent
              />
            </mesh>
          ) : (
            <group>
              <mesh position={[-0.22, 0.02, 0]}>
                <sphereGeometry args={[0.24, 22, 22]} />
                <meshPhysicalMaterial
                  color={LABORATORY_COLORS.water}
                  opacity={0.28}
                  transparent
                />
              </mesh>
              <mesh position={[0.22, 0.02, 0]}>
                <sphereGeometry args={[0.24, 22, 22]} />
                <meshPhysicalMaterial
                  color={LABORATORY_COLORS.water}
                  opacity={0.28}
                  transparent
                />
              </mesh>
            </group>
          )}

          {/* Two foetuses (different tint for fraternal, identical tint for identical, overlapping if joined) */}
          <mesh
            castShadow
            position={[-foetusOffset, 0.04, 0]}
            rotation={[0, 0, 0.2]}
          >
            <capsuleGeometry args={[0.085, 0.15, 10, 18]} />
            <meshStandardMaterial
              color={
                kind === "fraternal" ? PLOT_COLORS.teal : BIOLOGY_COLORS.tubule
              }
            />
          </mesh>
          <mesh
            castShadow
            position={[foetusOffset, 0.04, 0]}
            rotation={[0, 0, -0.2]}
          >
            <capsuleGeometry args={[0.085, 0.15, 10, 18]} />
            <meshStandardMaterial
              color={
                kind === "fraternal"
                  ? PLOT_COLORS.violet
                  : BIOLOGY_COLORS.tubule
              }
            />
          </mesh>

          {/* Conjoined bridge highlight */}
          {outcome.joined && (
            <mesh position={[0, 0.04, 0]}>
              <boxGeometry args={[0.16, 0.12, 0.12]} />
              <meshStandardMaterial color={CELL_COLORS.reticulum} />
            </mesh>
          )}

          <ThreeLabel
            anchorY="bottom"
            color={ink}
            gap={0.04}
            position={[0, 0.36, 0]}
          >
            {parts.amnion}
          </ThreeLabel>
          <ThreeLabel
            anchorY="top"
            color={ink}
            gap={0.04}
            position={[0, -0.44, 0]}
          >
            {parts.placenta}
          </ThreeLabel>
        </group>
      </group>
    </group>
  );
}
