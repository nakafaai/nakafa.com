import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  CellKey,
  Level,
  Sex,
} from "@repo/design-system/components/contents/biology/gametogenesis/division";
import type { AnatomyPart } from "@repo/design-system/components/contents/biology/gametogenesis/organs";
import {
  GonadView,
  SystemView,
} from "@repo/design-system/components/contents/biology/gametogenesis/organs";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Match } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.85, 2.25];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.56, 0];
const STEP_SECONDS = 2.2;

/**
 * 3D gametogenesis scene covering four zoom levels: reproductive tract
 * (`system`), gonad cross-section (`gonad`), meiotic cell division (`meiosis`),
 * and mature gamete ultrastructure (`gamete`) for male and female sexes.
 */
export function GametogenesisScene({
  cells,
  level,
  onStep,
  parts,
  sex,
  step,
}: {
  readonly cells: Readonly<Record<CellKey, string>>;
  readonly level: Level;
  readonly onStep: (next: number) => void;
  readonly parts: Readonly<Record<AnatomyPart, string>>;
  readonly sex: Sex;
  readonly step: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const rootRef = useRef<Group>(null);
  const timer = useRef(0);
  const phase = useRef(0);

  if (!playing) {
    timer.current = 0;
  }

  useFrame((_, delta) => {
    const dt = simulationStep(delta);
    phase.current += dt;
    if (!playing) {
      return;
    }
    if (level === "meiosis") {
      timer.current += dt;
      if (timer.current >= STEP_SECONDS) {
        timer.current = 0;
        onStep((step + 1) % 4);
      }
    } else if (rootRef.current !== null) {
      rootRef.current.rotation.y = Math.sin(phase.current * 0.7) * 0.28;
    }
  });

  return (
    <group>
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[2.1, 0.04, 1.0]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.worktop}
          roughness={0.65}
        />
      </mesh>

      <group ref={rootRef}>
        {Match.value(level).pipe(
          Match.when("system", () => <SystemView parts={parts} sex={sex} />),
          Match.when("gonad", () => <GonadView parts={parts} sex={sex} />),
          Match.when("meiosis", () => {
            let xs: readonly number[] = [-0.54, -0.18, 0.18, 0.54];
            if (step <= 1) {
              xs = [0];
            } else if (step === 2) {
              xs = [-0.32, 0.32];
            }
            const count = xs.length;
            return (
              <group>
                {Arr.map(xs, (x, idx) => {
                  const isPolar = sex === "female" && count > 1 && idx > 0;
                  let radius = 0.14;
                  if (isPolar) {
                    radius = 0.07;
                  } else if (step === 1) {
                    radius = 0.2;
                  }
                  let fill: string = BIOLOGY_COLORS.eggNucleus;
                  if (isPolar) {
                    fill = PLOT_COLORS.slate;
                  } else if (sex === "male") {
                    fill = BIOLOGY_COLORS.spermNucleus;
                  }
                  return (
                    <group key={x} position={[x, 0.56, 0]}>
                      <mesh castShadow>
                        <sphereGeometry args={[radius, 22, 22]} />
                        <meshStandardMaterial
                          color={fill}
                          opacity={0.78}
                          transparent
                        />
                      </mesh>
                      <mesh>
                        <sphereGeometry args={[radius * 0.45, 16, 16]} />
                        <meshStandardMaterial color={CELL_COLORS.nucleus} />
                      </mesh>
                      {isPolar && idx === 1 && (
                        <ThreeLabel
                          anchorY="top"
                          color={ink}
                          gap={0.05}
                          position={[0, -0.12, 0]}
                        >
                          {cells.polarBody}
                        </ThreeLabel>
                      )}
                    </group>
                  );
                })}
              </group>
            );
          }),
          Match.when("gamete", () =>
            sex === "male" ? (
              <group position={[0, 0.56, 0]}>
                <mesh
                  castShadow
                  position={[-0.64, 0, 0]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <coneGeometry args={[0.1, 0.12, 18]} />
                  <meshStandardMaterial color={PLOT_COLORS.amber} />
                </mesh>
                <mesh
                  castShadow
                  position={[-0.48, 0, 0]}
                  scale={[1.25, 0.9, 0.85]}
                >
                  <sphereGeometry args={[0.11, 22, 22]} />
                  <meshStandardMaterial color={BIOLOGY_COLORS.spermNucleus} />
                </mesh>
                <mesh
                  castShadow
                  position={[-0.22, 0, 0]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.045, 0.045, 0.24, 16]} />
                  <meshStandardMaterial color={CELL_COLORS.mitochondrion} />
                </mesh>
                <mesh position={[0.34, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.015, 0.008, 0.92, 12]} />
                  <meshStandardMaterial color={LABORATORY_COLORS.steel} />
                </mesh>
                <ThreeLabel
                  anchorY="bottom"
                  color={ink}
                  gap={0.04}
                  position={[-0.64, 0.18, 0]}
                >
                  {parts.acrosome}
                </ThreeLabel>
                <ThreeLabel
                  anchorY="top"
                  color={ink}
                  gap={0.04}
                  position={[-0.48, -0.16, 0]}
                >
                  {parts.head}
                </ThreeLabel>
                <ThreeLabel
                  anchorY="bottom"
                  color={ink}
                  gap={0.04}
                  position={[-0.22, 0.14, 0]}
                >
                  {parts.middle}
                </ThreeLabel>
                <ThreeLabel
                  anchorY="bottom"
                  color={ink}
                  gap={0.04}
                  position={[0.36, 0.12, 0]}
                >
                  {parts.tail}
                </ThreeLabel>
              </group>
            ) : (
              <group position={[0, 0.56, 0]}>
                <mesh castShadow>
                  <sphereGeometry args={[0.34, 28, 28]} />
                  <meshStandardMaterial
                    color={BIOLOGY_COLORS.embryoSac}
                    opacity={0.75}
                    transparent
                  />
                </mesh>
                <mesh>
                  <sphereGeometry args={[0.12, 20, 20]} />
                  <meshStandardMaterial color={BIOLOGY_COLORS.eggNucleus} />
                </mesh>
                <mesh position={[0.24, 0.04, 0.14]}>
                  <sphereGeometry args={[0.12, 16, 16]} />
                  <meshStandardMaterial
                    color={LABORATORY_COLORS.water}
                    opacity={0.7}
                    transparent
                  />
                </mesh>
                {Arr.makeBy(10, (idx) => {
                  const angle = (idx / 10) * Math.PI * 2;
                  return (
                    <mesh
                      key={angle}
                      position={[
                        Math.cos(angle) * 0.4,
                        Math.sin(angle) * 0.4,
                        0,
                      ]}
                    >
                      <sphereGeometry args={[0.052, 12, 12]} />
                      <meshStandardMaterial color={BIOLOGY_COLORS.ovary} />
                    </mesh>
                  );
                })}
                <ThreeLabel
                  anchorX="left"
                  color={ink}
                  gap={0.04}
                  position={[0.46, 0.22, 0]}
                >
                  {parts.follicular}
                </ThreeLabel>
                <ThreeLabel
                  anchorX="left"
                  color={ink}
                  gap={0.04}
                  position={[0.38, -0.14, 0]}
                >
                  {parts.antrum}
                </ThreeLabel>
              </group>
            )
          ),
          Match.exhaustive
        )}
      </group>
    </group>
  );
}
