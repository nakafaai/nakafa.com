import { RoundedBox } from "@react-three/drei";
import { PLACES } from "@repo/design-system/components/contents/biology/equipment/places";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";

/**
 * The three objectives on the nosepiece: ×4, ×10 and ×40, each longer than
 * the last, with the colour ring ISO 8578 gives each magnification.
 */
const OBJECTIVES = [
  { color: BIOLOGY_COLORS.objectiveRed, key: 4, length: 0.026 },
  { color: BIOLOGY_COLORS.objectiveYellow, key: 10, length: 0.032 },
  { color: BIOLOGY_COLORS.objectiveBlue, key: 40, length: 0.038 },
] as const;

/** Where the nosepiece's hub sits over the stage, in metres from the microscope's foot. */
const NOSEPIECE = [0, 0.232, 0.022] as const;

/** How far the nosepiece leans back, so the objective in use hangs straight down over the slide. */
const NOSEPIECE_TILT = 0.38;

/**
 * A school light microscope about 360 mm tall, facing the learner: a heavy
 * enamel foot with its lamp, a curved arm with the coarse and fine focus
 * knobs, a black stage with two clips holding a slide over the condenser, a
 * revolving nosepiece of three objectives, and a monocular head inclined
 * towards the eye.
 */
export function Microscope() {
  const arm = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0.03, -0.075),
        new Vector3(0, 0.11, -0.082),
        new Vector3(0, 0.2, -0.068),
        new Vector3(0, 0.255, -0.03),
        new Vector3(0, 0.268, 0.004),
      ]),
    []
  );
  return (
    <group position={PLACES.microscope.base}>
      <RoundedBox
        args={[0.14, 0.032, 0.2]}
        castShadow
        position={[0, 0.016, -0.005]}
        radius={0.012}
        receiveShadow
      >
        <meshPhysicalMaterial
          clearcoat={0.7}
          clearcoatRoughness={0.2}
          color={BIOLOGY_COLORS.microscopeEnamel}
          roughness={0.32}
        />
      </RoundedBox>
      <mesh position={[0, 0.034, NOSEPIECE[2]]}>
        <cylinderGeometry args={[0.016, 0.018, 0.005, 32]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.5} />
      </mesh>
      <mesh castShadow>
        <tubeGeometry args={[arm, 48, 0.017, 20, false]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          clearcoatRoughness={0.2}
          color={BIOLOGY_COLORS.microscopeEnamel}
          roughness={0.32}
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <group
          key={side}
          position={[side * 0.023, 0.1, -0.078]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <mesh castShadow>
            <cylinderGeometry args={[0.021, 0.021, 0.012, 36]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.microscopeBlack}
              roughness={0.55}
            />
          </mesh>
          <mesh castShadow position={[0, side * -0.012, 0]}>
            <cylinderGeometry args={[0.011, 0.011, 0.012, 28]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.microscopeBlack}
              roughness={0.5}
            />
          </mesh>
        </group>
      ))}
      <mesh castShadow position={[0, 0.098, NOSEPIECE[2]]}>
        <cylinderGeometry args={[0.014, 0.012, 0.03, 28]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.microscopeBlack}
          roughness={0.45}
        />
      </mesh>
      <mesh castShadow position={[0, 0.12, -0.054]}>
        <boxGeometry args={[0.03, 0.03, 0.03]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          color={BIOLOGY_COLORS.microscopeEnamel}
          roughness={0.32}
        />
      </mesh>
      <RoundedBox
        args={[0.12, 0.008, 0.11]}
        castShadow
        position={[0, 0.12 + 0.004, 0.015]}
        radius={0.002}
        receiveShadow
      >
        <meshStandardMaterial
          color={BIOLOGY_COLORS.microscopeBlack}
          roughness={0.4}
        />
      </RoundedBox>
      <mesh position={[0, 0.1281, NOSEPIECE[2]]}>
        <cylinderGeometry args={[0.009, 0.009, 0.0004, 24]} />
        <meshBasicMaterial color={LABORATORY_COLORS.carbonBand} />
      </mesh>
      <mesh position={[0, 0.1286, NOSEPIECE[2]]}>
        <boxGeometry args={[0.076, 0.001, 0.026]} />
        <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.42} />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh castShadow key={side} position={[side * 0.03, 0.1298, -0.005]}>
          <boxGeometry args={[0.006, 0.0008, 0.05]} />
          <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.2} />
        </mesh>
      ))}
      <group position={NOSEPIECE} rotation={[-NOSEPIECE_TILT, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.027, 0.022, 0.013, 40]} />
          <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.22} />
        </mesh>
        {Arr.map(OBJECTIVES, (objective, index) => (
          <group
            key={objective.key}
            rotation={[0, (index - 1) * ((Math.PI * 2) / 3), 0]}
          >
            <group
              position={[0, -0.006, 0.016]}
              rotation={[NOSEPIECE_TILT, 0, 0]}
            >
              <mesh castShadow position={[0, -objective.length / 2, 0]}>
                <cylinderGeometry
                  args={[0.0085, 0.0065, objective.length, 24]}
                />
                <MetalMaterial
                  color={LABORATORY_COLORS.chrome}
                  roughness={0.18}
                />
              </mesh>
              <mesh position={[0, -objective.length * 0.62, 0]}>
                <cylinderGeometry args={[0.0081, 0.0077, 0.0028, 24]} />
                <meshStandardMaterial color={objective.color} roughness={0.4} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
      <mesh castShadow position={[0, 0.2625, 0.014]}>
        <cylinderGeometry args={[0.02, 0.022, 0.055, 32]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          color={BIOLOGY_COLORS.microscopeEnamel}
          roughness={0.32}
        />
      </mesh>
      <group position={[0, 0.286, 0.012]} rotation={[Math.PI / 4, 0, 0]}>
        <mesh castShadow position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.0125, 0.014, 0.08, 28]} />
          <meshPhysicalMaterial
            clearcoat={0.7}
            color={BIOLOGY_COLORS.microscopeEnamel}
            roughness={0.32}
          />
        </mesh>
        <mesh castShadow position={[0, 0.092, 0]}>
          <cylinderGeometry args={[0.013, 0.012, 0.024, 28]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.microscopeBlack}
            roughness={0.7}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Two 76 by 26 mm glass slides with frosted ends, one stained specimen under a 22 mm cover slip. */
export function Slides() {
  return (
    <group position={PLACES.slide.base}>
      {Arr.map([0, 1] as const, (index) => (
        <group
          key={index}
          position={[index * 0.012, 0.0005, index * -0.034]}
          rotation={[0, index * 0.12, 0]}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.076, 0.001, 0.026]} />
            <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.4} />
          </mesh>
          <mesh position={[-0.028, 0.0006, 0]}>
            <boxGeometry args={[0.02, 0.0002, 0.0258]} />
            <meshStandardMaterial
              color={LABORATORY_COLORS.frost}
              roughness={0.85}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0.008, 0.0011, 0]} scale={[1, 1, 0.7]}>
        <cylinderGeometry args={[0.0055, 0.0055, 0.0002, 24]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.stain}
          opacity={0.75}
          roughness={0.5}
          transparent
        />
      </mesh>
      <mesh position={[0.008, 0.0014, 0]}>
        <boxGeometry args={[0.022, 0.0003, 0.022]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.3} />
      </mesh>
    </group>
  );
}
