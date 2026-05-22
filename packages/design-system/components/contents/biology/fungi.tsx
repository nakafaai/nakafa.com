"use client";

import {
  type BiologyLabProps,
  type BiologySceneProps,
  createBiologyGridPoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyGround,
  BiologyLine,
  FloatingGroup,
  PulsingGroup,
  SlidingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

const SPORE_POINTS = createBiologyGridPoints(2, 5);
const HYPHA_LEFT = [
  [-1.2, -0.65, 0],
  [-0.72, -0.28, 0],
  [-0.15, -0.18, 0],
  [0.35, 0.12, 0],
] as const;
const HYPHA_RIGHT = [
  [-0.45, -0.5, 0],
  [-0.15, -0.18, 0],
  [0.48, -0.2, 0],
  [1.25, -0.55, 0],
] as const;
const HYPHA_TOP = [
  [-0.05, -0.2, 0],
  [0.12, 0.2, 0],
  [0.62, 0.58, 0],
] as const;
const HYPHA_BRANCHES = [
  { id: "left", tip: [0.35, 0.12, 0] },
  { id: "right", tip: [1.25, -0.55, 0] },
  { id: "top", tip: [0.62, 0.58, 0] },
] as const;

/**
 * Renders fungal hypha, spore, and mutualism-decomposition views.
 */
export function FungiGrowthLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={FungiGrowthScene} {...props} />;
}

/**
 * Changes the visible fungal process behind each tab.
 */
function FungiGrowthScene({ colors, selectedIndex }: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <SporeRelease colors={colors} />;
  }

  if (selectedIndex === 2) {
    return <FungalRole colors={colors} />;
  }

  return <HyphaNetwork colors={colors} />;
}

/**
 * Shows hyphae branching into a mycelium network.
 */
function HyphaNetwork({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <BiologyGround color={colors.soil} />
      <PulsingGroup speed={0.9} strength={0.025}>
        <BiologyLine
          color={colors.decomposer}
          lineWidth={4}
          points={HYPHA_LEFT}
        />
        <BiologyLine
          color={colors.decomposer}
          lineWidth={4}
          points={HYPHA_RIGHT}
        />
        <BiologyLine
          color={colors.decomposer}
          lineWidth={4}
          points={HYPHA_TOP}
        />
      </PulsingGroup>
      {HYPHA_BRANCHES.map((branch, index) => (
        <PulsingGroup key={branch.id} phase={index * 0.8} strength={0.12}>
          <mesh position={branch.tip}>
            <sphereGeometry args={[0.08, 12, 10]} />
            <meshStandardMaterial color={colors.spore} />
          </mesh>
        </PulsingGroup>
      ))}
    </group>
  );
}

/**
 * Shows spores leaving a fruiting body.
 */
function SporeRelease({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh position={[0, -0.52, 0]} scale={[0.18, 0.72, 0.18]}>
        <capsuleGeometry args={[0.16, 0.76, 8, 18]} />
        <meshStandardMaterial color={colors.decomposer} />
      </mesh>
      <mesh position={[0, 0.08, 0]} scale={[0.72, 0.28, 0.42]}>
        <sphereGeometry args={[1, 32, 18]} />
        <meshStandardMaterial color={colors.spore} opacity={0.82} transparent />
      </mesh>
      {SPORE_POINTS.map((point, index) => (
        <FloatingGroup
          key={point.id}
          phase={index * 0.45}
          speed={1.3}
          travel={0.16}
        >
          <mesh
            position={[
              point.position[0] * 0.24,
              point.position[1] * 0.22 + 0.68,
              0.22,
            ]}
          >
            <sphereGeometry args={[0.055, 12, 10]} />
            <meshStandardMaterial color={colors.spore} />
          </mesh>
        </FloatingGroup>
      ))}
      <ArrowHelper
        arrowSize={0.11}
        color={colors.arrow}
        from={[0, 0.34, 0.18]}
        to={[0.72, 0.86, 0.18]}
      />
    </group>
  );
}

/**
 * Shows fungi connecting dead matter and roots.
 */
function FungalRole({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <BiologyGround color={colors.soil} />
      <mesh position={[-1, -0.38, 0.2]} rotation={[0, 0, -0.48]}>
        <boxGeometry args={[0.62, 0.16, 0.18]} />
        <meshStandardMaterial color={colors.muted} />
      </mesh>
      <group position={[0.9, -0.48, 0.15]}>
        <mesh position={[0, 0.34, 0]}>
          <coneGeometry args={[0.22, 0.72, 12]} />
          <meshStandardMaterial color={colors.plant} />
        </mesh>
        <mesh position={[0, -0.1, 0]} scale={[0.08, 0.44, 0.08]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={colors.decomposer} />
        </mesh>
      </group>
      <SlidingGroup speed={0.8} travel={0.05}>
        <BiologyLine
          color={colors.decomposer}
          lineWidth={4}
          points={HYPHA_RIGHT}
        />
      </SlidingGroup>
    </group>
  );
}
