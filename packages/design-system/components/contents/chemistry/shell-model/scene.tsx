import { useReducedMotion } from "@mantine/hooks";
import { useFrame } from "@react-three/fiber";
import { useShellModel } from "@repo/design-system/components/contents/chemistry/shell-model/context";
import type { ShellModelShells } from "@repo/design-system/components/contents/chemistry/shell-model/data";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import type { RefObject } from "react";
import { useRef } from "react";
import type { Group } from "three";

const SHELL_RENDER_CONFIG = [
  { radius: 0.94, speed: 1.15 },
  { radius: 1.58, speed: 0.84 },
  { radius: 2.22, speed: 0.62 },
  { radius: 2.86, speed: 0.46 },
] as const;

const ELECTRON_RADIUS = 0.082;
const OUTER_ELECTRON_RADIUS = 0.098;
const NUCLEUS_RADIUS = 0.44;
const NUCLEUS_LABEL_OUTLINE_WIDTH = 0.012;

/** Deterministic packed Fibonacci-sphere nucleon cluster (protons + neutrons). */
const NUCLEONS = Arr.makeBy(18, (idx) => {
  const phi = Math.acos(1 - (2 * (idx + 0.5)) / 18);
  const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
  const r = idx < 4 ? 0.11 : 0.23;
  return {
    id: `nuc-${idx}`,
    isProton: idx % 2 === 0,
    pos: [
      Math.sin(phi) * Math.cos(theta) * r,
      Math.cos(phi) * r,
      Math.sin(phi) * Math.sin(theta) * r,
    ] as const,
  };
});

/**
 * Renders a neutral atom with a clustered 3D nucleon core, precision metallic
 * Bohr energy-level tracks, luminous electrons with orbital phase wakes, and
 * clean Play/Pause/Stop/Reset clock synchronisation.
 */
export function ShellModelScene() {
  const { outerShellKey, shells } = useShellModel();
  const { advance, playing } = useSimulationClock(0);
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });
  const shellRefs = useRef<(Group | null)[]>([]);
  const nucleusRef = useRef<Group>(null);

  useFrame((_, delta) => {
    const t = calm ? 0 : advance(delta);
    if (nucleusRef.current !== null) {
      nucleusRef.current.rotation.y = t * 0.35;
      nucleusRef.current.rotation.x = Math.sin(t * 0.5) * 0.12;
    }
    for (let i = 0; i < SHELL_RENDER_CONFIG.length; i += 1) {
      const group = shellRefs.current[i];
      const cfg = SHELL_RENDER_CONFIG[i];
      if (group !== null && group !== undefined && cfg !== undefined) {
        group.rotation.y = t * cfg.speed;
      }
    }
  });

  return (
    <group rotation={[-0.28, 0, 0]} scale={1.12}>
      <SimulationTicker running={playing && !calm} />
      <Nucleus clusterRef={nucleusRef} />

      {Arr.map(shells, (shell, shellIndex) => {
        const shellConfig = SHELL_RENDER_CONFIG[shellIndex];

        if (!shellConfig) {
          return null;
        }

        return (
          <ShellRing
            isOuterShell={shell.key === outerShellKey}
            key={shell.key}
            radius={shellConfig.radius}
            shellKey={shell.key}
          />
        );
      })}

      {Arr.map(shells, (shell, shellIndex) => {
        const shellConfig = SHELL_RENDER_CONFIG[shellIndex];

        if (!shellConfig || shell.electronCount === 0) {
          return null;
        }

        return (
          <OrbitingShellElectrons
            groupRef={(el) => {
              shellRefs.current[shellIndex] = el;
            }}
            isOuterShell={shell.key === outerShellKey}
            key={`electrons-${shell.key}`}
            radius={shellConfig.radius}
            shell={shell}
            shellIndex={shellIndex}
          />
        );
      })}
    </group>
  );
}

/** Clustered 3D proton-neutron nucleus wrapped in a soft translucent nuclear binding aura. */
function Nucleus({
  clusterRef,
}: {
  readonly clusterRef: RefObject<Group | null>;
}) {
  const { colors } = useShellModel();
  return (
    <group>
      <group ref={clusterRef}>
        {Arr.map(NUCLEONS, (nuc) => (
          <mesh castShadow key={nuc.id} position={nuc.pos}>
            <sphereGeometry args={[0.155, 22, 16]} />
            <meshPhysicalMaterial
              clearcoat={0.82}
              clearcoatRoughness={0.12}
              color={nuc.isProton ? colors.nucleus : QUANTUM_COLORS.neutron}
              emissive={nuc.isProton ? colors.nucleus : QUANTUM_COLORS.neutron}
              emissiveIntensity={nuc.isProton ? 0.2 : 0.06}
              metalness={0.08}
              roughness={0.24}
            />
          </mesh>
        ))}
      </group>
      {/* Translucent nuclear binding-field aura */}
      <mesh>
        <sphereGeometry args={[NUCLEUS_RADIUS + 0.04, 36, 24]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.06}
          color={colors.nucleus}
          depthWrite={false}
          opacity={0.16}
          roughness={0.12}
          transparent
        />
      </mesh>
      <NucleusLabel />
    </group>
  );
}

function NucleusLabel() {
  const { colors, sample } = useShellModel();
  return (
    <ThreeLabel
      color={colors.sphereText}
      fontSize="reading"
      outlineColor={colors.sphereTextOutline}
      outlineWidth={NUCLEUS_LABEL_OUTLINE_WIDTH}
      position={[0, 0.34, 0.18]}
    >
      <InlineMath
        math={`\\vphantom{X}_{${sample.atomicNumber}}\\mathrm{${sample.symbol}}`}
      />
    </ThreeLabel>
  );
}

/** Brushed metallic energy-level track with luminous valence accent and crisp shell label. */
function ShellRing({
  isOuterShell,
  radius,
  shellKey,
}: {
  isOuterShell: boolean;
  radius: number;
  shellKey: string;
}) {
  const { colors } = useShellModel();

  return (
    <group>
      {/* Primary sculpted energy track */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, isOuterShell ? 0.024 : 0.013, 16, 112]} />
        {isOuterShell ? (
          <meshPhysicalMaterial
            clearcoat={0.9}
            clearcoatRoughness={0.1}
            color={colors.outerShell}
            emissive={colors.outerShell}
            emissiveIntensity={0.32}
            metalness={0.42}
            roughness={0.22}
          />
        ) : (
          <MetalMaterial color={INSTRUMENT_COLORS.aluminium} roughness={0.28} />
        )}
      </mesh>
      {/* Subtle translucent quantum energy halo ribbon around track */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry
          args={[
            radius - (isOuterShell ? 0.07 : 0.036),
            radius + (isOuterShell ? 0.07 : 0.036),
            96,
          ]}
        />
        <meshBasicMaterial
          color={isOuterShell ? colors.outerShell : colors.shell}
          depthWrite={false}
          opacity={isOuterShell ? 0.16 : 0.07}
          transparent
        />
      </mesh>
      <ThreeLabel
        color={colors.text}
        fontSize="reading"
        position={[radius + 0.25, 0.14, 0.12]}
      >
        <InlineMath math={`\\mathrm{${shellKey}}`} />
      </ThreeLabel>
    </group>
  );
}

function OrbitingShellElectrons({
  groupRef,
  isOuterShell,
  radius,
  shell,
  shellIndex,
}: {
  groupRef: (el: Group | null) => void;
  isOuterShell: boolean;
  radius: number;
  shell: ShellModelShells[number];
  shellIndex: number;
}) {
  const electronRadius = isOuterShell ? OUTER_ELECTRON_RADIUS : ELECTRON_RADIUS;
  const orbitExtent = radius + electronRadius;
  const electrons = Arr.makeBy(shell.electronCount, (idx) => idx);

  return (
    <CameraBounds
      bounds={{
        x: { min: -orbitExtent, max: orbitExtent },
        y: { min: -electronRadius, max: electronRadius },
        z: { min: -orbitExtent, max: orbitExtent },
      }}
    >
      <group ref={groupRef}>
        <group rotation={[0, shellIndex * 0.24, 0]}>
          {Arr.map(electrons, (electronIndex) => {
            const angle =
              (2 * Math.PI * electronIndex) / shell.electronCount +
              shellIndex * 0.42;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            return (
              <Electron
                angle={angle}
                isOuterShell={isOuterShell}
                key={`${shell.key}-${electronIndex}`}
                orbitRadius={radius}
                position={[x, 0, z]}
                radius={electronRadius}
              />
            );
          })}
        </group>
      </group>
    </CameraBounds>
  );
}

/** Glossy luminous electron sphere with soft electrostatic halo and subtle orbital wake arc. */
function Electron({
  angle,
  isOuterShell,
  orbitRadius,
  position,
  radius,
}: {
  angle: number;
  isOuterShell: boolean;
  orbitRadius: number;
  position: readonly [number, number, number];
  radius: number;
}) {
  const { colors } = useShellModel();
  const tone = isOuterShell ? colors.outerElectron : colors.electron;

  return (
    <group>
      {/* Curved trailing phase wake along the shell orbit */}
      <mesh rotation={[Math.PI / 2, 0, -angle - 0.34]}>
        <torusGeometry args={[orbitRadius, radius * 0.28, 8, 18, 0.34]} />
        <meshStandardMaterial
          color={tone}
          depthWrite={false}
          emissive={tone}
          emissiveIntensity={0.65}
          opacity={0.34}
          transparent
        />
      </mesh>
      <group position={position}>
        <mesh castShadow>
          <sphereGeometry args={[radius, 28, 20]} />
          <meshPhysicalMaterial
            clearcoat={0.95}
            clearcoatRoughness={0.08}
            color={tone}
            emissive={tone}
            emissiveIntensity={isOuterShell ? 0.55 : 0.35}
            roughness={0.14}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[radius * 1.55, 18, 14]} />
          <meshStandardMaterial
            color={tone}
            depthWrite={false}
            emissive={tone}
            emissiveIntensity={0.6}
            opacity={0.2}
            transparent
          />
        </mesh>
      </group>
    </group>
  );
}
