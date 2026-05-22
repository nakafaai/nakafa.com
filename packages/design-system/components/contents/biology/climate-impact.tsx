"use client";

import {
  type BiologyLabProps,
  type BiologySceneProps,
  createBiologyGridPoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyGround,
  FloatingGroup,
  PulsingGroup,
  SlidingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

const MOSQUITO_POINTS = createBiologyGridPoints(2, 3);

/**
 * Renders ecosystem and human impacts of climate change.
 */
export function ClimateImpactLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={ClimateImpactScene} {...props} />;
}

/**
 * Uses separate impact cases so risk does not look like one generic disaster.
 */
function ClimateImpactScene({ colors, selectedIndex }: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <FoodAndWaterStress colors={colors} />;
  }

  if (selectedIndex === 2) {
    return <HealthVectorRisk colors={colors} />;
  }

  return <CoralBleaching colors={colors} />;
}

/**
 * Shows coral bleaching as a biological stress response.
 */
function CoralBleaching({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh position={[0, -0.55, 0]} scale={[2.2, 0.22, 0.55]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors.ocean} opacity={0.5} transparent />
      </mesh>
      {[-0.75, -0.25, 0.35, 0.82].map((x, index) => (
        <PulsingGroup key={x} phase={index * 0.5} strength={0.04}>
          <mesh position={[x, -0.28, 0.3]} rotation={[0, 0, index * 0.4]}>
            <coneGeometry args={[0.12, 0.58, 7]} />
            <meshStandardMaterial
              color={index < 2 ? colors.ice : colors.warning}
            />
          </mesh>
        </PulsingGroup>
      ))}
      <ArrowHelper
        color={colors.heat}
        from={[0.92, 0.72, 0.2]}
        to={[0.42, -0.05, 0.2]}
      />
    </group>
  );
}

/**
 * Shows dry soil and crop stress as linked food-water pressure.
 */
function FoodAndWaterStress({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <BiologyGround color={colors.soil} />
      {[-0.8, -0.25, 0.32].map((x, index) => (
        <FloatingGroup key={x} phase={index * 0.6} travel={0.035}>
          <group
            position={[x, -0.48, 0.2]}
            rotation={[0, 0, index === 1 ? 0.22 : -0.18]}
          >
            <mesh position={[0, 0.25, 0]}>
              <coneGeometry args={[0.14, 0.42, 8]} />
              <meshStandardMaterial
                color={colors.plant}
                opacity={0.58}
                transparent
              />
            </mesh>
            <mesh scale={[0.06, 0.38, 0.06]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial
                color={colors.plant}
                opacity={0.5}
                transparent
              />
            </mesh>
          </group>
        </FloatingGroup>
      ))}
      <mesh position={[0.92, -0.58, 0.32]} scale={[0.36, 0.12, 0.18]}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshStandardMaterial color={colors.ocean} opacity={0.36} transparent />
      </mesh>
      <ArrowHelper
        color={colors.heat}
        from={[0.9, 0.78, 0.25]}
        to={[0.2, -0.15, 0.25]}
      />
    </group>
  );
}

/**
 * Shows warm conditions expanding vector-borne disease risk.
 */
function HealthVectorRisk({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh position={[0.9, -0.25, 0.18]}>
        <sphereGeometry args={[0.36, 24, 14]} />
        <meshStandardMaterial color={colors.host} />
      </mesh>
      {MOSQUITO_POINTS.map((point, index) => (
        <SlidingGroup key={point.id} phase={index * 0.35} travel={0.12}>
          <group
            position={[
              point.position[0] * 0.34 - 0.55,
              point.position[1] * 0.28,
              0.28,
            ]}
          >
            <mesh scale={[0.18, 0.08, 0.08]}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color={colors.pathogen} />
            </mesh>
            <mesh position={[0.14, 0.04, 0]}>
              <boxGeometry args={[0.22, 0.02, 0.02]} />
              <meshStandardMaterial color={colors.arrow} />
            </mesh>
          </group>
        </SlidingGroup>
      ))}
      <ArrowHelper
        color={colors.warning}
        from={[-0.08, 0.02, 0.2]}
        to={[0.48, -0.14, 0.2]}
      />
    </group>
  );
}
