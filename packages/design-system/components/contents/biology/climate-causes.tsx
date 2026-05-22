"use client";

import {
  type BiologyLabProps,
  type BiologySceneProps,
  createBiologyGridPoints,
  createBiologyRingPoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyGround,
  FloatingGroup,
  PulsingGroup,
  RotatingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

const GAS_RING = createBiologyRingPoints(18, 1.1);
const EXHAUST_POINTS = createBiologyGridPoints(2, 4);

/**
 * Renders greenhouse effect, fossil fuel, and land-waste cause views.
 */
export function ClimateCauseLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={ClimateCauseScene} {...props} />;
}

/**
 * Separates physical mechanism from human activity sources.
 */
function ClimateCauseScene({ colors, selectedIndex }: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <FossilFuelSource colors={colors} />;
  }

  if (selectedIndex === 2) {
    return <LandAndWasteSource colors={colors} />;
  }

  return <GreenhouseEffect colors={colors} />;
}

/**
 * Shows sunlight entering and infrared energy being retained by gases.
 */
function GreenhouseEffect({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.72, 40, 24]} />
        <meshStandardMaterial color={colors.ocean} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.04, 48, 24]} />
        <meshStandardMaterial
          color={colors.membrane}
          opacity={0.16}
          transparent
        />
      </mesh>
      <RotatingGroup speed={0.2}>
        {GAS_RING.map((point) => (
          <mesh
            key={point.id}
            position={[point.position[0], point.position[2] * 0.62, 0.18]}
          >
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color={colors.carbon} />
          </mesh>
        ))}
      </RotatingGroup>
      <ArrowHelper
        color={colors.heat}
        from={[-1.35, 0.78, 0.2]}
        to={[-0.42, 0.2, 0.2]}
      />
      <ArrowHelper
        color={colors.warning}
        from={[0.38, 0.08, 0.2]}
        to={[0.92, 0.72, 0.2]}
      />
    </group>
  );
}

/**
 * Shows combustion sources adding carbon dioxide to the air.
 */
function FossilFuelSource({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh position={[-0.78, -0.42, 0.14]} scale={[0.8, 0.24, 0.28]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors.muted} />
      </mesh>
      <mesh position={[-1.08, -0.62, 0.22]}>
        <torusGeometry args={[0.14, 0.04, 8, 24]} />
        <meshStandardMaterial color={colors.text} />
      </mesh>
      <mesh position={[-0.48, -0.62, 0.22]}>
        <torusGeometry args={[0.14, 0.04, 8, 24]} />
        <meshStandardMaterial color={colors.text} />
      </mesh>
      <mesh position={[0.65, -0.2, 0.16]} scale={[0.18, 0.95, 0.18]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors.muted} />
      </mesh>
      {EXHAUST_POINTS.map((point, index) => (
        <FloatingGroup key={point.id} phase={index * 0.4} travel={0.16}>
          <mesh
            position={[
              point.position[0] * 0.22 + 0.55,
              point.position[1] * 0.18 + 0.62,
              0.28,
            ]}
          >
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshStandardMaterial color={colors.carbon} />
          </mesh>
        </FloatingGroup>
      ))}
    </group>
  );
}

/**
 * Shows deforestation and organic waste emissions as land-use causes.
 */
function LandAndWasteSource({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <BiologyGround color={colors.soil} />
      <mesh position={[-0.85, -0.52, 0.2]} rotation={[0, 0, -0.64]}>
        <boxGeometry args={[0.78, 0.14, 0.16]} />
        <meshStandardMaterial color={colors.decomposer} />
      </mesh>
      <mesh position={[0.4, -0.38, 0.22]} scale={[0.42, 0.28, 0.32]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors.muted} />
      </mesh>
      {[0.22, 0.52, 0.82].map((x, index) => (
        <PulsingGroup key={x} phase={index * 0.6} strength={0.08}>
          <mesh position={[x, 0.05 + x * 0.26, 0.32]}>
            <sphereGeometry args={[0.075, 12, 10]} />
            <meshStandardMaterial color={colors.carbon} />
          </mesh>
        </PulsingGroup>
      ))}
      <ArrowHelper
        color={colors.warning}
        from={[0.62, -0.04, 0.2]}
        to={[0.92, 0.58, 0.2]}
      />
    </group>
  );
}
