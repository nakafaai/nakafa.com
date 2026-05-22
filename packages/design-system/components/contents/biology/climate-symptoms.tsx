"use client";

import {
  type BiologyLabProps,
  type BiologySceneProps,
  createBiologyRingPoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyLine,
  FloatingGroup,
  PulsingGroup,
  RotatingGroup,
  SlidingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

const HEAT_RING = createBiologyRingPoints(16, 1.05);
const SEA_LINE = [
  [-1.25, -0.35, 0.28],
  [-0.45, -0.3, 0.28],
  [0.35, -0.25, 0.28],
  [1.25, -0.2, 0.28],
] as const;

/**
 * Renders temperature, ocean, and ice-sea-level indicators.
 */
export function ClimateSymptomsLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={ClimateSymptomsScene} {...props} />;
}

/**
 * Teaches symptoms as measurable indicators, not a single weather event.
 */
function ClimateSymptomsScene({ colors, selectedIndex }: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <OceanHeat colors={colors} />;
  }

  if (selectedIndex === 2) {
    return <IceAndSeaLevel colors={colors} />;
  }

  return <TemperatureIndicator colors={colors} />;
}

/**
 * Shows long-term warming as a heat ring around Earth.
 */
function TemperatureIndicator({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.78, 40, 24]} />
        <meshStandardMaterial color={colors.ocean} />
      </mesh>
      <RotatingGroup speed={0.22}>
        {HEAT_RING.map((point) => (
          <mesh
            key={point.id}
            position={[point.position[0], point.position[2] * 0.62, 0.16]}
          >
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color={colors.heat} />
          </mesh>
        ))}
      </RotatingGroup>
      <ArrowHelper
        color={colors.heat}
        from={[1.05, -0.55, 0.2]}
        to={[1.05, 0.75, 0.2]}
      />
    </group>
  );
}

/**
 * Shows the ocean storing heat below the surface.
 */
function OceanHeat({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh position={[0, -0.25, 0]} scale={[2.4, 0.48, 0.55]}>
        <sphereGeometry args={[1, 36, 18]} />
        <meshStandardMaterial color={colors.ocean} opacity={0.72} transparent />
      </mesh>
      {[-0.8, -0.25, 0.35, 0.9].map((x, index) => (
        <FloatingGroup key={x} phase={index * 0.7} travel={0.11}>
          <mesh position={[x, -0.2 + index * 0.12, 0.34]}>
            <sphereGeometry args={[0.08, 12, 10]} />
            <meshStandardMaterial color={colors.heat} />
          </mesh>
        </FloatingGroup>
      ))}
      <mesh position={[-0.55, -0.7, 0.38]} scale={[0.18, 0.34, 0.18]}>
        <coneGeometry args={[1, 1, 8]} />
        <meshStandardMaterial
          color={colors.warning}
          opacity={0.62}
          transparent
        />
      </mesh>
    </group>
  );
}

/**
 * Shows ice loss and higher sea level in one coastal cross-section.
 */
function IceAndSeaLevel({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <PulsingGroup speed={0.9} strength={0.035}>
        <mesh position={[-0.8, 0.05, 0.15]} scale={[0.58, 0.5, 0.5]}>
          <octahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial color={colors.ice} />
        </mesh>
      </PulsingGroup>
      <mesh position={[0.42, -0.52, 0.05]} scale={[1.1, 0.25, 0.42]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors.soil} />
      </mesh>
      <SlidingGroup speed={0.6} travel={0.05}>
        <BiologyLine color={colors.ocean} lineWidth={5} points={SEA_LINE} />
      </SlidingGroup>
      <ArrowHelper
        color={colors.ocean}
        from={[1.28, -0.5, 0.3]}
        to={[1.28, -0.1, 0.3]}
      />
    </group>
  );
}
