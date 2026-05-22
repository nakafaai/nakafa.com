"use client";

import {
  type BiologyLabProps,
  type BiologySceneProps,
  createBiologyRingPoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyLine,
  BiologySceneTitle,
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
function ClimateCooperationScene({
  colors,
  item,
  selectedIndex,
}: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <ClimateMonitoring colors={colors} label={item.label} />;
  }

  if (selectedIndex === 2) {
    return <SharedAction colors={colors} label={item.label} />;
  }

  return <ParisTarget colors={colors} label={item.label} />;
}

/**
 * Shows the Paris temperature target as a readable global frame.
 */
function ParisTarget({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.7, 40, 22]} />
        <meshStandardMaterial color={colors.ocean} />
      </mesh>
      {TARGET_RING.map((point) => (
        <mesh
          key={point.id}
          position={[point.position[0], point.position[2] * 0.6, 0.16]}
        >
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color={colors.heat} />
        </mesh>
      ))}
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[0, -0.92, 0.18]}
      >
        1.5
      </SceneLabel>
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
    </group>
  );
}

/**
 * Shows climate data as stations connected around one planet.
 */
function ClimateMonitoring({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.58, 34, 18]} />
        <meshStandardMaterial color={colors.ocean} opacity={0.82} transparent />
      </mesh>
      {NETWORK_POINTS.map((point) => (
        <group
          key={point.id}
          position={[point.position[0], point.position[2] * 0.62, 0.22]}
        >
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
      ))}
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
    </group>
  );
}

/**
 * Shows countries and communities as connected action nodes.
 */
function SharedAction({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
  return (
    <group>
      {NETWORK_POINTS.map((point, index) => (
        <mesh
          key={point.id}
          position={[point.position[0], point.position[2] * 0.58, 0.16]}
        >
          <sphereGeometry args={[0.1, 12, 10]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? colors.plant : colors.animal}
          />
        </mesh>
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
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
    </group>
  );
}
