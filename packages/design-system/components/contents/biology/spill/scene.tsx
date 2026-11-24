import { useFrame } from "@react-three/fiber";
import type { Incident } from "@repo/design-system/components/contents/biology/spill/protocol";
import { nextStage } from "@repo/design-system/components/contents/biology/spill/protocol";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Match } from "effect";
import { useRef } from "react";

const CAMERA_POSITION: readonly [number, number, number] = [0.05, 0.72, 1.18];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.14, 0];
const STAGE_SECONDS = 2.4;

const MERCURY_BEADS: readonly (readonly [number, number])[] = [
  [-0.08, 0.04],
  [-0.03, 0.08],
  [0.02, 0.02],
  [0.07, 0.06],
  [0.01, -0.04],
];

const GLASS_SHARDS: readonly (readonly [number, number, number])[] = [
  [-0.1, 0.04, 0.3],
  [-0.02, 0.07, 1.1],
  [0.06, -0.02, 2.2],
  [0.11, 0.05, 0.7],
];

/**
 * 3D laboratory bench staging all five emergency response protocols stage by
 * stage: eye chemical splash, broken mercury thermometer, microbial culture
 * spill, broken glass, and benchtop solvent fire.
 */
export function SpillScene({
  incident,
  onStage,
  stage,
}: {
  readonly incident: Incident;
  readonly onStage: (index: number) => void;
  readonly stage: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const timer = useRef(0);
  const pulse = useRef(0);

  if (!playing) {
    timer.current = 0;
  }

  useFrame((_, delta) => {
    const dt = simulationStep(delta);
    pulse.current += dt;
    if (!playing) {
      return;
    }
    timer.current += dt;
    if (timer.current >= STAGE_SECONDS) {
      timer.current = 0;
      onStage(nextStage(incident, stage));
    }
  });

  return (
    <group>
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      {/* Laboratory bench and ceramic splashback */}
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[1.35, 0.04, 0.72]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.worktop}
          roughness={0.6}
        />
      </mesh>
      <mesh position={[0, 0.28, -0.35]} receiveShadow>
        <boxGeometry args={[1.35, 0.62, 0.02]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.wallTile}
          roughness={0.5}
        />
      </mesh>

      {Match.value(incident).pipe(
        Match.when("eye", () => (
          <group>
            {/* Wall-mounted eyewash bowl & twin nozzles */}
            <mesh castShadow position={[0, 0.14, -0.08]}>
              <cylinderGeometry args={[0.16, 0.11, 0.09, 24]} />
              <meshStandardMaterial
                color={LABORATORY_COLORS.safeGreen}
                roughness={0.4}
              />
            </mesh>
            <mesh position={[-0.05, 0.19, -0.08]}>
              <cylinderGeometry args={[0.015, 0.015, 0.04, 14]} />
              <meshStandardMaterial color={LABORATORY_COLORS.capYellow} />
            </mesh>
            <mesh position={[0.05, 0.19, -0.08]}>
              <cylinderGeometry args={[0.015, 0.015, 0.04, 14]} />
              <meshStandardMaterial color={LABORATORY_COLORS.capYellow} />
            </mesh>
            {/* Spilled chemical bottle */}
            <mesh
              castShadow
              position={[-0.36, 0.04, 0.08]}
              rotation={[0, 0, Math.PI / 2.2]}
            >
              <cylinderGeometry args={[0.032, 0.032, 0.11, 18]} />
              <meshStandardMaterial
                color={LABORATORY_COLORS.amberGlass}
                roughness={0.3}
              />
            </mesh>
            {/* Running water streams during open & rinse stages */}
            {stage >= 1 && stage <= 2 && (
              <group>
                <mesh position={[-0.05, 0.27, -0.08]}>
                  <cylinderGeometry args={[0.008, 0.014, 0.14, 12]} />
                  <meshStandardMaterial
                    color={LABORATORY_COLORS.water}
                    opacity={0.8}
                    transparent
                  />
                </mesh>
                <mesh position={[0.05, 0.27, -0.08]}>
                  <cylinderGeometry args={[0.008, 0.014, 0.14, 12]} />
                  <meshStandardMaterial
                    color={LABORATORY_COLORS.water}
                    opacity={0.8}
                    transparent
                  />
                </mesh>
              </group>
            )}
            {/* First aid / medical badge on final stage */}
            {stage >= 3 && (
              <group position={[0.35, 0.28, -0.32]}>
                <mesh>
                  <boxGeometry args={[0.16, 0.16, 0.02]} />
                  <meshStandardMaterial color={LABORATORY_COLORS.safeGreen} />
                </mesh>
                <mesh position={[0, 0, 0.012]}>
                  <boxGeometry args={[0.09, 0.028, 0.006]} />
                  <meshStandardMaterial color={LABORATORY_COLORS.cross} />
                </mesh>
                <mesh position={[0, 0, 0.012]}>
                  <boxGeometry args={[0.028, 0.09, 0.006]} />
                  <meshStandardMaterial color={LABORATORY_COLORS.cross} />
                </mesh>
              </group>
            )}
          </group>
        )),
        Match.when("mercury", () => (
          <group>
            {/* Broken glass thermometer */}
            <mesh
              castShadow
              position={[-0.22, 0.012, 0.02]}
              rotation={[0, 0.2, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.006, 0.006, 0.22, 12]} />
              <meshStandardMaterial color={LABORATORY_COLORS.polystyrene} />
            </mesh>
            {/* Metallic mercury beads (cleared once sealed) */}
            {stage < 4 &&
              Arr.map(MERCURY_BEADS, ([x, z]) => (
                <mesh
                  key={`${x}-${z}`}
                  position={[
                    stage >= 2 ? x * 0.35 : x,
                    0.01,
                    stage >= 2 ? z * 0.35 : z,
                  ]}
                >
                  <sphereGeometry args={[0.014, 14, 14]} />
                  <meshStandardMaterial
                    color={LABORATORY_COLORS.mercury}
                    metalness={0.9}
                    roughness={0.12}
                  />
                </mesh>
              ))}
            {/* Stage 0+: hazard warning cone */}
            <mesh castShadow position={[-0.42, 0.075, 0.14]}>
              <coneGeometry args={[0.055, 0.15, 16]} />
              <meshStandardMaterial color={PLOT_COLORS.amber} />
            </mesh>
            {/* Stage 1+: open window sash on back wall */}
            <mesh position={[0.32, 0.34, -0.33]}>
              <boxGeometry args={[0.32, 0.24, 0.02]} />
              <meshStandardMaterial
                color={
                  stage >= 1
                    ? LABORATORY_COLORS.water
                    : LABORATORY_COLORS.chamberInside
                }
                opacity={stage >= 1 ? 0.65 : 1}
                transparent
              />
            </mesh>
            {/* Stage 2: stiff card sweeping beads */}
            {stage === 2 && (
              <mesh
                castShadow
                position={[0.08, 0.04, 0.08]}
                rotation={[0.4, -0.3, 0]}
              >
                <boxGeometry args={[0.12, 0.08, 0.004]} />
                <meshStandardMaterial color={LABORATORY_COLORS.cardboard} />
              </mesh>
            )}
            {/* Stage 3+: yellow sulfur powder covering mercury */}
            {stage === 3 && (
              <mesh position={[0, 0.016, 0.02]}>
                <cylinderGeometry args={[0.11, 0.14, 0.028, 22]} />
                <meshStandardMaterial
                  color={LABORATORY_COLORS.sulfur}
                  roughness={0.9}
                />
              </mesh>
            )}
            {/* Stage 4: sealed labelled waste jar */}
            {stage >= 4 && (
              <group position={[0.22, 0.07, 0]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.055, 0.055, 0.14, 20]} />
                  <meshStandardMaterial
                    color={LABORATORY_COLORS.amberGlass}
                    roughness={0.3}
                  />
                </mesh>
                <mesh position={[0, 0.078, 0]}>
                  <cylinderGeometry args={[0.058, 0.058, 0.022, 20]} />
                  <meshStandardMaterial color={LABORATORY_COLORS.carbonBand} />
                </mesh>
              </group>
            )}
          </group>
        )),
        Match.when("culture", () => (
          <group>
            {/* Tipped Petri dish & agar spill */}
            <mesh
              castShadow
              position={[-0.24, 0.03, 0]}
              rotation={[0.4, 0.2, 0.8]}
            >
              <cylinderGeometry args={[0.048, 0.048, 0.016, 22]} />
              <meshStandardMaterial color={LABORATORY_COLORS.agar} />
            </mesh>
            {stage < 3 && (
              <mesh position={[0, 0.004, 0.03]}>
                <cylinderGeometry args={[0.15, 0.16, 0.006, 24]} />
                <meshStandardMaterial
                  color={LABORATORY_COLORS.agar}
                  roughness={0.45}
                />
              </mesh>
            )}
            {/* Paper towels covering the spill */}
            {stage >= 1 && stage < 3 && (
              <mesh position={[0, 0.012, 0.03]}>
                <boxGeometry args={[0.32, 0.012, 0.28]} />
                <meshStandardMaterial
                  color={
                    stage >= 2
                      ? LABORATORY_COLORS.disinfectant
                      : LABORATORY_COLORS.paper
                  }
                  roughness={0.85}
                />
              </mesh>
            )}
            {/* Disinfectant bottle pouring during soak stage */}
            {stage === 2 && (
              <mesh
                castShadow
                position={[0.24, 0.14, 0.03]}
                rotation={[0, 0, 0.65]}
              >
                <cylinderGeometry args={[0.036, 0.036, 0.15, 18]} />
                <meshStandardMaterial color={LABORATORY_COLORS.disinfectant} />
              </mesh>
            )}
            {/* Biohazard autoclave bag on final collect stage */}
            {stage >= 3 && (
              <mesh castShadow position={[0.26, 0.11, 0]}>
                <cylinderGeometry args={[0.09, 0.11, 0.22, 20]} />
                <meshStandardMaterial
                  color={LABORATORY_COLORS.biohazardOrange}
                  roughness={0.55}
                />
              </mesh>
            )}
          </group>
        )),
        Match.when("glass", () => (
          <group>
            {/* Broken glass shards */}
            {stage < 2 &&
              Arr.map(GLASS_SHARDS, ([x, z, rot]) => (
                <mesh
                  castShadow
                  key={`${x}-${z}-${rot}`}
                  position={[stage >= 1 ? x * 0.35 + 0.08 : x, 0.012, z]}
                  rotation={[0.3, rot, 0.2]}
                >
                  <coneGeometry args={[0.022, 0.034, 3]} />
                  <meshPhysicalMaterial
                    color={LABORATORY_COLORS.polystyrene}
                    opacity={0.78}
                    roughness={0.12}
                    transparent
                  />
                </mesh>
              ))}
            {/* Dustpan & brush during sweep stage */}
            {stage === 1 && (
              <group position={[0.12, 0.014, 0.04]}>
                <mesh castShadow>
                  <boxGeometry args={[0.16, 0.012, 0.14]} />
                  <meshStandardMaterial color={LABORATORY_COLORS.steel} />
                </mesh>
                <mesh
                  castShadow
                  position={[-0.1, 0.05, 0.04]}
                  rotation={[0, 0.3, -0.4]}
                >
                  <boxGeometry args={[0.14, 0.024, 0.032]} />
                  <meshStandardMaterial color={LABORATORY_COLORS.wood} />
                </mesh>
              </group>
            )}
            {/* Corrugated broken-glass disposal box */}
            <mesh castShadow position={[0.36, 0.11, -0.06]}>
              <boxGeometry args={[0.22, 0.22, 0.22]} />
              <meshStandardMaterial
                color={LABORATORY_COLORS.cardboard}
                roughness={0.75}
              />
            </mesh>
          </group>
        )),
        Match.when("fire", () => (
          <group>
            {/* Gas tap with yellow lever (turns off at stage >= 0) */}
            <group position={[-0.36, 0.04, -0.14]}>
              <mesh>
                <cylinderGeometry args={[0.018, 0.022, 0.08, 16]} />
                <meshStandardMaterial
                  color={LABORATORY_COLORS.brass}
                  metalness={0.6}
                />
              </mesh>
              <mesh
                position={[0, 0.045, 0]}
                rotation={[0, stage >= 0 ? Math.PI / 2 : 0, 0]}
              >
                <boxGeometry args={[0.08, 0.012, 0.018]} />
                <meshStandardMaterial color={LABORATORY_COLORS.gasLever} />
              </mesh>
            </group>
            {/* Solvent dish & flame */}
            <mesh castShadow position={[0, 0.02, 0.02]}>
              <cylinderGeometry args={[0.08, 0.075, 0.04, 22]} />
              <meshStandardMaterial color={LABORATORY_COLORS.ceramic} />
            </mesh>
            {stage < 2 && (
              <group position={[0, 0.11, 0.02]}>
                <mesh scale={[1, stage === 1 ? 0.55 : 1, 1]}>
                  <coneGeometry args={[0.065, 0.18, 16]} />
                  <meshStandardMaterial
                    color={LABORATORY_COLORS.flame}
                    emissive={LABORATORY_COLORS.flame}
                    emissiveIntensity={0.65}
                    opacity={0.85}
                    transparent
                  />
                </mesh>
                <mesh
                  position={[0, -0.025, 0]}
                  scale={[1, stage === 1 ? 0.5 : 1, 1]}
                >
                  <coneGeometry args={[0.036, 0.1, 14]} />
                  <meshStandardMaterial
                    color={LABORATORY_COLORS.flameCore}
                    emissive={LABORATORY_COLORS.flameCore}
                    emissiveIntensity={0.8}
                  />
                </mesh>
              </group>
            )}
            {/* Fire blanket draped over dish on smother stage */}
            {stage === 1 && (
              <mesh castShadow position={[0, 0.06, 0.02]}>
                <boxGeometry args={[0.26, 0.014, 0.24]} />
                <meshStandardMaterial
                  color={LABORATORY_COLORS.coat}
                  roughness={0.85}
                />
              </mesh>
            )}
            {/* Red CO2 extinguisher with black band & discharge cloud */}
            {stage >= 2 && (
              <group position={[0.32, 0.16, 0.02]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.055, 0.055, 0.32, 22]} />
                  <meshStandardMaterial
                    color={LABORATORY_COLORS.fireRed}
                    roughness={0.35}
                  />
                </mesh>
                <mesh position={[0, 0.06, 0]}>
                  <cylinderGeometry args={[0.057, 0.057, 0.06, 22]} />
                  <meshStandardMaterial color={LABORATORY_COLORS.carbonBand} />
                </mesh>
                {stage === 2 && (
                  <mesh
                    position={[-0.22, -0.06, 0]}
                    rotation={[0, 0, Math.PI / 2]}
                  >
                    <coneGeometry args={[0.09, 0.28, 18]} />
                    <meshStandardMaterial
                      color={LABORATORY_COLORS.steam}
                      opacity={0.7}
                      transparent
                    />
                  </mesh>
                )}
              </group>
            )}
            {/* Green emergency exit sign illuminated on leave stage */}
            {stage >= 3 && (
              <mesh position={[0, 0.36, -0.32]}>
                <boxGeometry args={[0.32, 0.12, 0.025]} />
                <meshStandardMaterial
                  color={LABORATORY_COLORS.safeGreen}
                  emissive={LABORATORY_COLORS.safeGreen}
                  emissiveIntensity={0.5}
                />
              </mesh>
            )}
          </group>
        )),
        Match.exhaustive
      )}
    </group>
  );
}
