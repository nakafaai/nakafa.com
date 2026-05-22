"use client";

import {
  type BiologyLabProps,
  type BiologySceneProps,
  type BiologySceneView,
  createBiologyGridPoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  PulsingGroup,
  SlidingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import { MiniEnvelopedVirion } from "@repo/design-system/components/contents/biology/virus-parts";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

const DROPLETS = createBiologyGridPoints(3, 5);
const PREVENTION_VIEW = {
  cameraPosition: [0, 1.8, 4.15],
  cameraTarget: [0, -0.05, 0],
  narrowCameraPosition: [0, 2.05, 4.75],
} satisfies BiologySceneView;

/**
 * Renders the virus prevention lab with different barriers for different routes.
 */
export function VirusPreventionLab(props: BiologyLabProps) {
  return (
    <BiologyLabFrame
      scene={VirusPreventionScene}
      view={PREVENTION_VIEW}
      {...props}
    />
  );
}

/**
 * Compares distance, barrier, and hygiene-immunity interventions as separate visuals.
 */
function VirusPreventionScene({ colors, selectedIndex }: BiologySceneProps) {
  const hasMask = selectedIndex === 1;
  const hasSoap = selectedIndex === 2;
  const dropletScale = selectedIndex === 0 ? 1.06 : 0.62;

  return (
    <group>
      <PersonFigure
        color={colors.host}
        hasMask={hasMask}
        maskColor={colors.ice}
        x={-1.35}
      />
      <PersonFigure
        color={colors.plant}
        hasMask={false}
        maskColor={colors.ice}
        x={1.35}
      />

      {hasMask && (
        <mesh position={[-0.76, 0.16, 0.18]} scale={[0.08, 0.72, 0.12]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={colors.ice} opacity={0.46} transparent />
        </mesh>
      )}

      {hasSoap && (
        <PulsingGroup speed={1.6} strength={0.05}>
          <mesh position={[0, -0.68, 0]} scale={[1.35, 0.16, 0.16]}>
            <capsuleGeometry args={[0.14, 1.58, 6, 16]} />
            <meshStandardMaterial color={colors.ocean} />
          </mesh>
          {[-0.72, -0.36, 0, 0.36, 0.72].map((x) => (
            <mesh key={x} position={[x, -0.42, 0.12]}>
              <torusGeometry args={[0.09, 0.012, 6, 28]} />
              <meshStandardMaterial color={colors.ice} />
            </mesh>
          ))}
        </PulsingGroup>
      )}

      {DROPLETS.map((point, index) => (
        <SlidingGroup
          key={point.id}
          phase={index * 0.42}
          speed={hasSoap ? 0.45 : 1.2}
          travel={hasMask || hasSoap ? 0.06 : 0.22}
        >
          <group
            position={[
              point.position[0] * 0.22,
              point.position[1] * 0.22,
              0.25,
            ]}
            scale={dropletScale}
          >
            <DropletVirion colors={colors} faded={hasSoap} />
          </group>
        </SlidingGroup>
      ))}

      <ArrowHelper
        arrowSize={0.14}
        color={hasMask || hasSoap ? colors.muted : colors.warning}
        from={[-1.05, 0.18, 0.18]}
        lineWidth={3}
        to={[0.95, 0.18, 0.18]}
      />
    </group>
  );
}

/**
 * Renders a simple person silhouette with an optional fitted mask.
 */
function PersonFigure({
  color,
  hasMask,
  maskColor,
  x,
}: {
  color: string;
  hasMask: boolean;
  maskColor: string;
  x: number;
}) {
  return (
    <group position={[x, -0.16, 0]}>
      <mesh position={[0, 0.44, 0]} scale={[0.28, 0.32, 0.24]}>
        <sphereGeometry args={[1, 28, 18]} />
        <meshStandardMaterial color={color} roughness={0.78} />
      </mesh>
      <mesh position={[0, -0.12, 0]} scale={[0.24, 0.7, 0.18]}>
        <capsuleGeometry args={[0.55, 0.62, 10, 20]} />
        <meshStandardMaterial color={color} opacity={0.78} transparent />
      </mesh>
      {hasMask && (
        <mesh position={[0.17, 0.38, 0.18]} scale={[0.2, 0.12, 0.035]}>
          <capsuleGeometry args={[0.5, 0.52, 8, 16]} />
          <meshStandardMaterial color={maskColor} roughness={0.82} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Shows a respiratory droplet carrying a small enveloped virion.
 */
function DropletVirion({
  colors,
  faded,
}: {
  colors: BiologySceneProps["colors"];
  faded: boolean;
}) {
  return (
    <group>
      <mesh scale={[0.11, 0.08, 0.08]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial
          color={faded ? colors.muted : colors.ocean}
          opacity={faded ? 0.22 : 0.34}
          transparent
        />
      </mesh>
      <MiniEnvelopedVirion colors={colors} scale={faded ? 0.34 : 0.42} />
    </group>
  );
}
