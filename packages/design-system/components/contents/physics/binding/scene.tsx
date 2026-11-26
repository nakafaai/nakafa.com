import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  NuclearProcess,
  NuclideId,
} from "@repo/design-system/components/contents/physics/binding/model";
import { nuclideSpec } from "@repo/design-system/components/contents/physics/binding/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { AdditiveBlending } from "three";

function computeLobeShift(
  process: NuclearProcess,
  nuclide: NuclideId,
  rawX: number
): number {
  const sign = rawX >= 0 ? 1 : -1;
  if (process === "fission") {
    return sign * 0.14;
  }
  if (nuclide === "iron56") {
    return 0;
  }
  return sign * 0.09;
}

function buildNucleonLayout(
  displayCount: number,
  protonTarget: number,
  nuclide: NuclideId,
  process: NuclearProcess
) {
  return Arr.makeBy(displayCount, (index) => {
    const isLeft = index % 2 === 0;
    const isProton = index < protonTarget;
    if (displayCount === 2) {
      const offset = process === "fusion" ? 0.24 : 0.11;
      return {
        id: `n-${index}`,
        isProton,
        x: isLeft ? -offset : offset,
        y: 0,
        z: 0,
      };
    }
    const phi = Math.acos(1 - (2 * (index + 0.5)) / displayCount);
    const theta = Math.PI * (1 + Math.sqrt(5)) * index;
    const shell = index < displayCount * 0.35 ? 0.56 : 1;
    const baseR = (0.16 + Math.cbrt(displayCount) * 0.088) * shell;
    const rawX = baseR * Math.sin(phi) * Math.cos(theta);
    const rawY = baseR * Math.cos(phi);
    const rawZ = baseR * Math.sin(phi) * Math.sin(theta);

    const lobeShift = computeLobeShift(process, nuclide, rawX);
    const pinch =
      process === "fission" ? 1 - Math.exp(-rawX * rawX * 18) * 0.32 : 1;

    return {
      id: `n-${index}`,
      isProton,
      x: rawX + lobeShift,
      y: rawY * pinch,
      z: rawZ * pinch,
    };
  });
}

function resolveAuraColor(
  isIronPeak: boolean,
  process: NuclearProcess
): string {
  if (isIronPeak) {
    return QUANTUM_COLORS.ironPeak;
  }
  return process === "fusion"
    ? QUANTUM_COLORS.fusionZone
    : QUANTUM_COLORS.fissionZone;
}

function ProcessCue({
  isIronPeak,
  process,
}: {
  readonly isIronPeak: boolean;
  readonly process: NuclearProcess;
}) {
  if (isIronPeak) {
    return (
      <mesh rotation={[Math.PI / 2.2, 0.25, 0]}>
        <torusGeometry args={[0.64, 0.016, 12, 56]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.ironPeak}
          emissive={QUANTUM_COLORS.ironPeak}
          emissiveIntensity={0.85}
          roughness={0.2}
        />
      </mesh>
    );
  }
  if (process === "fission") {
    return (
      <group position={[-0.78, 0.04, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.075, 20, 16]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.fissionZone}
            emissive={QUANTUM_COLORS.fissionZone}
            emissiveIntensity={0.7}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0.18, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.01, 0.01, 0.26, 10]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.fissionZone}
            emissive={QUANTUM_COLORS.fissionZone}
            emissiveIntensity={0.65}
          />
        </mesh>
      </group>
    );
  }
  return (
    <mesh rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.025, 0.025, 0.34, 14]} />
      <meshStandardMaterial
        color={QUANTUM_COLORS.fusionZone}
        emissive={QUANTUM_COLORS.fusionZone}
        emissiveIntensity={0.9}
      />
    </mesh>
  );
}

function BindingCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.4, 3.0] : [0, 1.12, 2.38]}
      cameraTarget={[0, 0.58, 0]}
      fov={36}
      maxDistance={5.8}
      minDistance={1.3}
    />
  );
}

export function NuclearBindingScene({
  nuclide,
  parts,
  process,
}: {
  readonly nuclide: NuclideId;
  readonly parts: Readonly<
    Record<
      "fissionZone" | "fusionZone" | "ironPeak" | "neutron" | "proton",
      string
    >
  >;
  readonly process: NuclearProcess;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const clusterRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const spec = nuclideSpec(nuclide);
  const displayCount = Math.min(32, spec.massNumber);
  const protonTarget = Math.max(
    1,
    Math.round((spec.protons / spec.massNumber) * displayCount)
  );

  // Close-packed multi-shell nucleon cluster responding to both nuclide and process
  const nucleons = useMemo(
    () => buildNucleonLayout(displayCount, protonTarget, nuclide, process),
    [displayCount, nuclide, process, protonTarget]
  );

  useVisualStop(() => {
    phaseRef.current = 0;
    if (clusterRef.current !== null) {
      clusterRef.current.rotation.y = 0;
      clusterRef.current.scale.set(1, 1, 1);
    }
  });

  useFrame((_, delta) => {
    if (!playing || clusterRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.95;
    clusterRef.current.rotation.y = phaseRef.current;
    const pulse =
      process === "fission"
        ? 1 + Math.sin(phaseRef.current * 2.4) * 0.06
        : 1 - Math.abs(Math.sin(phaseRef.current * 1.8)) * 0.05;
    clusterRef.current.scale.set(pulse, 1, 1);
  });

  const isIronPeak = nuclide === "iron56";
  const zoneText = isIronPeak
    ? parts.ironPeak
    : parts[process === "fusion" ? "fusionZone" : "fissionZone"];
  const auraColor = resolveAuraColor(isIronPeak, process);

  return (
    <group>
      <SimulationTicker running={playing} />
      <BindingCamera />

      <group position={[0, 0.58, 0]} ref={clusterRef}>
        {/* Packed glossy protons and brushed metallic neutrons */}
        {Arr.map(nucleons, (item) => (
          <mesh castShadow key={item.id} position={[item.x, item.y, item.z]}>
            <sphereGeometry args={[0.105, 24, 18]} />
            {item.isProton ? (
              <meshPhysicalMaterial
                clearcoat={0.9}
                clearcoatRoughness={0.14}
                color={QUANTUM_COLORS.proton}
                metalness={0.08}
                roughness={0.22}
              />
            ) : (
              <MetalMaterial color={QUANTUM_COLORS.neutron} roughness={0.28} />
            )}
          </mesh>
        ))}

        {/* Strong-nuclear-force binding aura shell */}
        <mesh scale={[process === "fission" ? 1.32 : 1.08, 1, 1]}>
          <sphereGeometry
            args={[0.24 + Math.cbrt(displayCount) * 0.105, 28, 22]}
          />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color={auraColor}
            depthWrite={false}
            opacity={0.14}
            transparent
          />
        </mesh>

        {/* Equatorial stability ring on Iron-56 or process energy bridge */}
        <ProcessCue isIronPeak={isIronPeak} process={process} />
      </group>

      {/* Crisp compact non-overlapping labels */}
      <ThreeLabel
        color={ink}
        fontSize="compact"
        maximumFontSize={13}
        minimumFontSize={11}
        position={[-0.86, 0.92, 0]}
      >
        <span>{parts.proton}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        maximumFontSize={13}
        minimumFontSize={11}
        position={[0.86, 0.92, 0]}
      >
        <span>{parts.neutron}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        maximumFontSize={13}
        minimumFontSize={11}
        position={[0, 1.24, 0]}
      >
        <span>{zoneText}</span>
      </ThreeLabel>
    </group>
  );
}
