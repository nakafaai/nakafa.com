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
} from "@repo/design-system/components/contents/biology/parts";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

const NETWORK_POINTS = createBiologyRingPoints(7, 1.1);
const TARGET_RING = createBiologyRingPoints(14, 0.9);

/**
 * Renders Paris target, data network, and shared action views.
 */
export function ClimateCooperationLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={ClimateCooperationScene} {...props} />;
}

/**
 * Shows cooperation as targets, monitoring, and connected action.
 */
function ClimateCooperationScene({ colors, selectedIndex }: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <ClimateMonitoring colors={colors} />;
  }

  if (selectedIndex === 2) {
    return <SharedAction colors={colors} />;
  }

  return <ParisTarget colors={colors} />;
}

/**
 * Shows the Paris temperature target as a readable global frame.
 */
function ParisTarget({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.7, 40, 22]} />
        <meshStandardMaterial color={colors.ocean} />
      </mesh>
      <RotatingGroup speed={0.18}>
        {TARGET_RING.map((point) => (
          <mesh
            key={point.id}
            position={[point.position[0], point.position[2] * 0.6, 0.16]}
          >
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color={colors.heat} />
          </mesh>
        ))}
      </RotatingGroup>
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[0, -0.92, 0.18]}
      >
        1.5
      </SceneLabel>
    </group>
  );
}

/**
 * Shows climate data as stations connected around one planet.
 */
function ClimateMonitoring({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.58, 34, 18]} />
        <meshStandardMaterial color={colors.ocean} opacity={0.82} transparent />
      </mesh>
      {NETWORK_POINTS.map((point, index) => (
        <FloatingGroup key={point.id} phase={index * 0.4} travel={0.06}>
          <group position={[point.position[0], point.position[2] * 0.62, 0.22]}>
            <mesh>
              <sphereGeometry args={[0.07, 10, 8]} />
              <meshStandardMaterial color={colors.ice} />
            </mesh>
            <ArrowHelper
              color={colors.arrow}
              from={[0, 0, 0]}
              to={[-point.position[0] * 0.26, -point.position[2] * 0.16, 0]}
            />
          </group>
        </FloatingGroup>
      ))}
    </group>
  );
}

/**
 * Shows countries and communities as connected action nodes.
 */
function SharedAction({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      {NETWORK_POINTS.map((point, index) => (
        <PulsingGroup key={point.id} phase={index * 0.45} strength={0.06}>
          <mesh position={[point.position[0], point.position[2] * 0.58, 0.16]}>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshStandardMaterial
              color={index % 2 === 0 ? colors.plant : colors.animal}
            />
          </mesh>
        </PulsingGroup>
      ))}
      <BiologyLine
        color={colors.arrow}
        lineWidth={2}
        points={NETWORK_POINTS.map(
          (point) => [point.position[0], point.position[2] * 0.58, 0] as const
        )}
      />
      <ArrowHelper
        color={colors.plant}
        from={[-0.15, -0.86, 0.15]}
        to={[0.15, -0.52, 0.15]}
      />
    </group>
  );
}
