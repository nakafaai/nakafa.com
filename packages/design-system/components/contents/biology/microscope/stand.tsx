import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { Array as Arr, Option } from "effect";
import { useMemo, useRef } from "react";
import { CatmullRomCurve3, type Group, Vector3 } from "three";

/** Where the microscope stands on the bench, in metres. */
const SPOT = [0.25, 0, 0.1] as const;

/** How high the stage's top stands, in metres. */
const STAGE_HEIGHT = 0.125;

/** Where the nosepiece's hub sits, in metres, relative to the microscope. */
const NOSEPIECE = [0, 0.235, -0.004] as const;

/**
 * The nosepiece tilts its axis back this far, and each objective leans out
 * from the axis as far, so the one at the front hangs straight down.
 */
const NOSEPIECE_TILT = 0.42;

/**
 * The colour ring a maker paints on each objective, by its magnification:
 * red for ×4, yellow for ×10, light blue for ×40, white for ×100, as the
 * ISO 8578 code has it.
 */
function ringColor(objective: number) {
  if (objective <= 4) {
    return BIOLOGY_COLORS.objectiveRed;
  }
  if (objective <= 10) {
    return BIOLOGY_COLORS.objectiveYellow;
  }
  return objective <= 40
    ? BIOLOGY_COLORS.objectiveBlue
    : BIOLOGY_COLORS.objectiveWhite;
}

/**
 * A school compound microscope at real size on the bench: a heavy base with
 * its lamp, a curved arm with coarse and fine focus knobs, a stage with two
 * clips holding a slide, a revolving nosepiece whose objectives grow longer
 * as they magnify more, and an inclined eyepiece. The nosepiece turns until
 * the chosen objective hangs over the slide.
 */
export function MicroscopeStand({
  objective,
  objectives,
}: {
  readonly objective: number;
  readonly objectives: readonly [number, ...number[]];
}) {
  const ink = useLabelInk();
  const turret = useRef<Group>(null);
  const chosen = Option.getOrElse(
    Arr.findFirstIndex(objectives, (each) => each === objective),
    () => 0
  );
  const spacing = (Math.PI * 2) / Math.max(objectives.length, 3);
  const arm = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0.03, -0.075),
        new Vector3(0, 0.1, -0.08),
        new Vector3(0, 0.19, -0.07),
        new Vector3(0, 0.25, -0.035),
        new Vector3(0, 0.27, 0),
      ]),
    []
  );

  // The nosepiece eases round to the chosen objective.
  useFrame((state, delta) => {
    const group = turret.current;
    if (group === null) {
      return;
    }
    const target = -chosen * spacing;
    const gap = target - group.rotation.y;
    if (Math.abs(gap) > 0.001) {
      group.rotation.y += gap * Math.min(1, delta * 6);
      state.invalidate();
    }
  });

  return (
    <group>
      <StandCamera />
      <LabBench />
      <group position={SPOT}>
        <RoundedBox
          args={[0.15, 0.03, 0.2]}
          castShadow
          position={[0, 0.015, -0.01]}
          radius={0.01}
          receiveShadow
        >
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={BIOLOGY_COLORS.microscopeEnamel}
            roughness={0.35}
          />
        </RoundedBox>
        <mesh position={[0, 0.032, 0.012]}>
          <cylinderGeometry args={[0.018, 0.02, 0.006, 32]} />
          <meshBasicMaterial
            color={CAR_COLORS.headlightGlow}
            toneMapped={false}
          />
        </mesh>
        <mesh castShadow>
          <tubeGeometry args={[arm, 48, 0.017, 20, false]} />
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={BIOLOGY_COLORS.microscopeEnamel}
            roughness={0.35}
          />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <group
            key={side}
            position={[side * 0.024, 0.09, -0.07]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <mesh castShadow>
              <cylinderGeometry args={[0.022, 0.022, 0.012, 32]} />
              <meshStandardMaterial
                color={BIOLOGY_COLORS.microscopeBlack}
                roughness={0.6}
              />
            </mesh>
            <mesh castShadow position={[0, side * 0.012, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.012, 24]} />
              <meshStandardMaterial
                color={BIOLOGY_COLORS.microscopeBlack}
                roughness={0.6}
              />
            </mesh>
          </group>
        ))}
        <Stage />
        <mesh position={[0, STAGE_HEIGHT - 0.022, 0.012]}>
          <cylinderGeometry args={[0.016, 0.014, 0.03, 32]} />
          <MetalMaterial
            color={BIOLOGY_COLORS.microscopeBlack}
            roughness={0.4}
          />
        </mesh>
        <mesh castShadow position={[0, 0.265, 0.012]}>
          <cylinderGeometry args={[0.016, 0.018, 0.04, 32]} />
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={BIOLOGY_COLORS.microscopeEnamel}
            roughness={0.35}
          />
        </mesh>
        <group position={[0, 0.282, 0.012]} rotation={[0.62, 0, 0]}>
          <mesh castShadow position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.012, 0.014, 0.06, 28]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.microscopeBlack}
              roughness={0.45}
            />
          </mesh>
          <mesh position={[0, 0.062, 0]}>
            <cylinderGeometry args={[0.013, 0.013, 0.006, 28]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.microscopeBlack}
              roughness={0.7}
            />
          </mesh>
          <mesh position={[0, 0.0655, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.009, 28]} />
            <GlassMaterial color={BIOLOGY_COLORS.lensBlue} opacity={0.7} />
          </mesh>
        </group>
        <group position={NOSEPIECE} rotation={[NOSEPIECE_TILT, 0, 0]}>
          <group ref={turret}>
            <mesh castShadow>
              <cylinderGeometry args={[0.03, 0.026, 0.014, 40]} />
              <MetalMaterial color={CAR_COLORS.chrome} roughness={0.25} />
            </mesh>
            {Arr.map(objectives, (each, index) => {
              const length = 0.024 + Math.log10(each) * 0.016;
              const angle = index * spacing;
              return (
                <group key={each} rotation={[0, angle, 0]}>
                  <group
                    position={[0, 0, 0.017]}
                    rotation={[-NOSEPIECE_TILT, 0, 0]}
                  >
                    <mesh castShadow position={[0, -length / 2 - 0.007, 0]}>
                      <cylinderGeometry args={[0.0085, 0.0065, length, 28]} />
                      <MetalMaterial
                        color={CAR_COLORS.chrome}
                        roughness={0.2}
                      />
                    </mesh>
                    <mesh position={[0, -length * 0.35 - 0.007, 0]}>
                      <cylinderGeometry args={[0.0088, 0.0088, 0.003, 28]} />
                      <meshStandardMaterial
                        color={ringColor(each)}
                        roughness={0.4}
                      />
                    </mesh>
                  </group>
                </group>
              );
            })}
          </group>
        </group>
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[0.05, STAGE_HEIGHT + 0.05, 0.03]}
        >
          <InlineMath math={`\\times ${objective}`} />
        </ThreeLabel>
      </group>
    </group>
  );
}

/** The stage with its two clips and the slide they hold, a stained smear under a coverslip. */
function Stage() {
  return (
    <group position={[0, STAGE_HEIGHT, 0.01]}>
      <mesh castShadow position={[0, -0.004, 0]} receiveShadow>
        <boxGeometry args={[0.12, 0.008, 0.11]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.microscopeBlack}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[0, 0.0006, 0.002]}>
        <boxGeometry args={[0.076, 0.0012, 0.026]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.45} />
      </mesh>
      <mesh position={[0, 0.0014, 0.002]}>
        <boxGeometry args={[0.022, 0.0002, 0.022]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.35} />
      </mesh>
      <mesh position={[0, 0.0013, 0.002]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.006, 24]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.methyleneBlue}
          opacity={0.6}
          roughness={0.5}
          transparent
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={side}
          position={[side * 0.03, 0.0018, -0.012]}
          rotation={[0, side * 0.25, 0]}
        >
          <boxGeometry args={[0.006, 0.0012, 0.04]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

/** Looks at the microscope from the front and to one side, farther back on a narrow card. */
function StandCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 0.95 : 0.72;
  const [x, , z] = SPOT;
  return (
    <CameraControls
      cameraPosition={[
        x + distance * 0.55,
        0.22 + distance * 0.3,
        z + distance * 0.8,
      ]}
      cameraTarget={[x, 0.18, z]}
      fov={36}
      maxDistance={distance * 1.8}
      minDistance={0.15}
    />
  );
}
