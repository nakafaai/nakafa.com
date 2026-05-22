"use client";

import type {
  BiologyLabProps,
  BiologySceneProps,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyGround,
  BiologySceneTitle,
} from "@repo/design-system/components/contents/biology/parts";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

/**
 * Renders mitigation, adaptation, and restoration action views.
 */
export function ClimateActionLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={ClimateActionScene} {...props} />;
}

/**
 * Keeps climate action categories visually distinct.
 */
function ClimateActionScene({
  colors,
  item,
  selectedIndex,
}: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <AdaptationAction colors={colors} label={item.label} />;
  }

  if (selectedIndex === 2) {
    return <RestorationAction colors={colors} label={item.label} />;
  }

  return <MitigationAction colors={colors} label={item.label} />;
}

/**
 * Shows mitigation as reduced emissions and carbon uptake.
 */
function MitigationAction({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
  return (
    <group>
      <BiologyGround color={colors.soil} />
      <mesh position={[-0.9, -0.34, 0.2]} scale={[0.16, 0.72, 0.16]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors.muted} />
      </mesh>
      <mesh position={[-0.9, 0.2, 0.22]}>
        <sphereGeometry args={[0.18, 16, 12]} />
        <meshStandardMaterial color={colors.carbon} />
      </mesh>
      {[0.15, 0.55, 0.95].map((x) => (
        <group key={x} position={[x, -0.5, 0.22]}>
          <mesh position={[0, 0.32, 0]}>
            <coneGeometry args={[0.18, 0.58, 10]} />
            <meshStandardMaterial color={colors.plant} />
          </mesh>
          <mesh scale={[0.06, 0.34, 0.06]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={colors.decomposer} />
          </mesh>
        </group>
      ))}
      <ArrowHelper
        color={colors.plant}
        from={[-0.42, 0.12, 0.2]}
        to={[0.32, -0.02, 0.2]}
      />
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
    </group>
  );
}

/**
 * Shows adaptation as reducing harm while climate pressure continues.
 */
function AdaptationAction({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
  return (
    <group>
      <BiologyGround color={colors.soil} />
      <mesh position={[-0.75, -0.58, 0.2]} scale={[0.55, 0.08, 0.22]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors.ocean} />
      </mesh>
      <mesh position={[0, -0.42, 0.22]} scale={[0.22, 0.52, 0.18]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors.muted} />
      </mesh>
      {[0.52, 0.82, 1.12].map((x) => (
        <mesh key={x} position={[x, -0.24, 0.22]}>
          <coneGeometry args={[0.13, 0.44, 8]} />
          <meshStandardMaterial color={colors.plant} />
        </mesh>
      ))}
      <ArrowHelper
        color={colors.heat}
        from={[0.9, 0.82, 0.2]}
        to={[0.9, 0.12, 0.2]}
      />
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
    </group>
  );
}

/**
 * Shows restoration as rebuilding habitat structure.
 */
function RestorationAction({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
  return (
    <group>
      <BiologyGround color={colors.soil} />
      {[-0.75, -0.25, 0.35, 0.92].map((x, index) => (
        <group key={x} position={[x, -0.52, 0.2]}>
          <mesh position={[0, 0.28 + index * 0.06, 0]}>
            <coneGeometry args={[0.16, 0.5 + index * 0.08, 10]} />
            <meshStandardMaterial color={colors.plant} />
          </mesh>
          <mesh scale={[0.06, 0.34, 0.06]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={colors.decomposer} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.15, -0.26, 0.42]}>
        <sphereGeometry args={[0.12, 14, 10]} />
        <meshStandardMaterial color={colors.animal} />
      </mesh>
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
    </group>
  );
}
