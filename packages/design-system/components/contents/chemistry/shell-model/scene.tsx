import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type {
  ShellModelSample,
  ShellModelSceneColors,
  ShellModelShells,
} from "@repo/design-system/components/contents/chemistry/shell-model/data";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import {
  MONO_FONT_PATH,
  THREE_FONT_SIZE,
} from "@repo/design-system/components/three/data/constants";
import { useRef } from "react";
import type { Group } from "three";

const SHELL_RENDER_CONFIG = [
  { radius: 0.9, speed: 1.15 },
  { radius: 1.55, speed: 0.84 },
  { radius: 2.2, speed: 0.62 },
  { radius: 2.85, speed: 0.46 },
] satisfies { radius: number; speed: number }[];

const ELECTRON_RADIUS = 0.07;
const OUTER_ELECTRON_RADIUS = 0.085;
const NUCLEUS_RADIUS = 0.44;
const NUCLEUS_LABEL_SURFACE_OFFSET_RATIO = 1.06;
const NUCLEUS_SYMBOL_Y = 0.07;
const NUCLEUS_ATOMIC_NUMBER_Y = -0.18;
const NUCLEUS_LABEL_RENDER_ORDER = 10;
const NUCLEUS_LABEL_OUTLINE_WIDTH = 0.012;

/**
 * Renders a neutral atom as animated electron shells.
 */
export function ShellModelScene({
  colors,
  outerShellKey,
  sample,
  shells,
}: {
  colors: ShellModelSceneColors;
  outerShellKey: string;
  sample: ShellModelSample;
  shells: ShellModelShells;
}) {
  return (
    <group rotation={[-0.28, 0, 0]} scale={1.12}>
      <Nucleus colors={colors} sample={sample} />

      {shells.map((shell, shellIndex) => {
        const shellConfig = SHELL_RENDER_CONFIG[shellIndex];

        if (!shellConfig) {
          return null;
        }

        return (
          <ShellRing
            colors={colors}
            isOuterShell={shell.key === outerShellKey}
            key={shell.key}
            radius={shellConfig.radius}
            shellKey={shell.key}
          />
        );
      })}

      {shells.map((shell, shellIndex) => {
        const shellConfig = SHELL_RENDER_CONFIG[shellIndex];

        if (!shellConfig || shell.electronCount === 0) {
          return null;
        }

        return (
          <OrbitingShellElectrons
            colors={colors}
            isOuterShell={shell.key === outerShellKey}
            key={`electrons-${shell.key}`}
            radius={shellConfig.radius}
            shell={shell}
            shellIndex={shellIndex}
            speed={shellConfig.speed}
          />
        );
      })}
    </group>
  );
}

/**
 * Shows the nucleus as the visual anchor for the shell model.
 */
function Nucleus({
  colors,
  sample,
}: {
  colors: ShellModelSceneColors;
  sample: ShellModelSample;
}) {
  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[NUCLEUS_RADIUS, 48, 32]} />
        <meshStandardMaterial
          color={colors.nucleus}
          metalness={0.05}
          roughness={0.42}
        />
      </mesh>
      <NucleusLabel colors={colors} sample={sample} />
    </group>
  );
}

/**
 * Pins the element label to the visible side of the nucleus, matching the
 * particle-label pattern used in the subatomic-particles scene.
 */
function NucleusLabel({
  colors,
  sample,
}: {
  colors: ShellModelSceneColors;
  sample: ShellModelSample;
}) {
  return (
    <Billboard>
      <group
        position={[0, 0, NUCLEUS_RADIUS * NUCLEUS_LABEL_SURFACE_OFFSET_RATIO]}
      >
        <Text
          anchorX="center"
          anchorY="middle"
          color={colors.sphereText}
          font={MONO_FONT_PATH}
          fontSize={THREE_FONT_SIZE.display}
          outlineColor={colors.sphereTextOutline}
          outlineWidth={NUCLEUS_LABEL_OUTLINE_WIDTH}
          position={[0, NUCLEUS_SYMBOL_Y, 0]}
          renderOrder={NUCLEUS_LABEL_RENDER_ORDER}
        >
          {sample.symbol}
          <meshBasicMaterial
            color={colors.sphereText}
            depthTest={false}
            toneMapped={false}
          />
        </Text>

        <Text
          anchorX="center"
          anchorY="middle"
          color={colors.sphereText}
          font={MONO_FONT_PATH}
          fontSize={THREE_FONT_SIZE.annotation}
          outlineColor={colors.sphereTextOutline}
          outlineWidth={NUCLEUS_LABEL_OUTLINE_WIDTH}
          position={[0, NUCLEUS_ATOMIC_NUMBER_Y, 0]}
          renderOrder={NUCLEUS_LABEL_RENDER_ORDER}
        >
          {`Z = ${sample.atomicNumber}`}
          <meshBasicMaterial
            color={colors.sphereText}
            depthTest={false}
            toneMapped={false}
          />
        </Text>
      </group>
    </Billboard>
  );
}

/**
 * Draws one shell ring and its readable shell label.
 */
function ShellRing({
  colors,
  isOuterShell,
  radius,
  shellKey,
}: {
  colors: ShellModelSceneColors;
  isOuterShell: boolean;
  radius: number;
  shellKey: string;
}) {
  const shellColor = isOuterShell ? colors.outerShell : colors.shell;
  const opacity = isOuterShell ? 0.95 : 0.42;

  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, isOuterShell ? 0.018 : 0.01, 12, 96]} />
        <meshStandardMaterial
          color={shellColor}
          opacity={opacity}
          roughness={0.6}
          transparent
        />
      </mesh>
      <SceneLabel
        alwaysOnTop
        color={colors.text}
        fontSize={THREE_FONT_SIZE.reading}
        position={[radius + 0.24, 0.12, 0.12]}
      >
        {shellKey}
      </SceneLabel>
    </group>
  );
}

/**
 * Animates all electrons on one shell with deterministic spacing.
 */
function OrbitingShellElectrons({
  colors,
  isOuterShell,
  radius,
  shell,
  shellIndex,
  speed,
}: {
  colors: ShellModelSceneColors;
  isOuterShell: boolean;
  radius: number;
  shell: ShellModelShells[number];
  shellIndex: number;
  speed: number;
}) {
  const groupRef = useRef<Group>(null);
  const electrons = Array.from(
    { length: shell.electronCount },
    (_, electronIndex) => electronIndex
  );

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.y += delta * speed;
  });

  return (
    <group ref={groupRef} rotation={[0, shellIndex * 0.24, 0]}>
      {electrons.map((electronIndex) => {
        const angle =
          (2 * Math.PI * electronIndex) / shell.electronCount +
          shellIndex * 0.42;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        return (
          <Electron
            colors={colors}
            isOuterShell={isOuterShell}
            key={`${shell.key}-${electronIndex}`}
            position={[x, 0, z]}
          />
        );
      })}
    </group>
  );
}

/**
 * Renders one electron marker on a shell.
 */
function Electron({
  colors,
  isOuterShell,
  position,
}: {
  colors: ShellModelSceneColors;
  isOuterShell: boolean;
  position: readonly [number, number, number];
}) {
  return (
    <mesh castShadow position={position}>
      <sphereGeometry
        args={[isOuterShell ? OUTER_ELECTRON_RADIUS : ELECTRON_RADIUS, 24, 16]}
      />
      <meshStandardMaterial
        color={isOuterShell ? colors.outerElectron : colors.electron}
        emissive={isOuterShell ? colors.outerElectron : colors.electron}
        emissiveIntensity={0.16}
        roughness={0.35}
      />
    </mesh>
  );
}
