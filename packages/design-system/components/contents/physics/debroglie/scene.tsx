import { useFrame, useThree } from "@react-three/fiber";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function DeBroglieCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.4, 1.65, 3.6] : [0.3, 1.35, 2.9]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.4}
    />
  );
}

export function DeBroglieScene({
  diffractionRadius,
  parts,
}: {
  readonly diffractionRadius: number;
  readonly parts: Readonly<
    Record<
      | "diffractionRings"
      | "electronGun"
      | "graphiteTarget"
      | "matterWave"
      | "screen",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const waveRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const waveNodes = useMemo(
    () =>
      Arr.makeBy(18, (index) => ({
        id: `w-${index}`,
        x: -1.0 + index * 0.08,
      })),
    []
  );

  useFrame((_, delta) => {
    if (!playing || waveRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 5;
    const freq = 1 / Math.max(0.2, diffractionRadius);
    for (let i = 0; i < waveRef.current.children.length; i += 1) {
      const child = waveRef.current.children[i];
      if (child !== undefined) {
        child.position.y =
          0.56 + Math.sin(i * 0.55 * freq - phaseRef.current) * 0.08;
      }
    }
  });

  const ringInner = 0.14 + diffractionRadius * 0.18;
  const ringOuter = ringInner + 0.14 + diffractionRadius * 0.12;

  return (
    <group>
      <SimulationTicker running={playing} />
      <DeBroglieCamera />
      {/* Evacuated glass tube */}
      <mesh position={[0, 0.56, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.52, 0.34, 2.3, 28]} />
        <meshPhysicalMaterial
          color={QUANTUM_COLORS.glassTube}
          opacity={0.18}
          roughness={0.15}
          transparent
        />
      </mesh>
      {/* Electron gun */}
      <mesh
        castShadow
        position={[-1.16, 0.56, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.16, 0.18, 0.34, 18]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.benchSlate}
          roughness={0.5}
        />
      </mesh>
      {/* Graphite polycrystalline target */}
      <mesh
        castShadow
        position={[-0.1, 0.56, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.22, 0.22, 0.05, 20]} />
        <meshStandardMaterial color={QUANTUM_COLORS.graphite} roughness={0.6} />
      </mesh>
      {/* Standing matter-wave nodes */}
      <group ref={waveRef}>
        {Arr.map(waveNodes, (node) => (
          <mesh key={node.id} position={[node.x, 0.56, 0]}>
            <sphereGeometry args={[0.032, 10, 8]} />
            <meshStandardMaterial
              color={QUANTUM_COLORS.matterWave}
              roughness={0.3}
            />
          </mesh>
        ))}
      </group>
      {/* Phosphor screen and diffraction rings */}
      <group position={[1.14, 0.56, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh>
          <circleGeometry args={[0.5, 32]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.screenGlow}
            roughness={0.45}
          />
        </mesh>
        <mesh position={[0, 0, 0.015]}>
          <torusGeometry args={[ringInner, 0.018, 8, 32]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.diffractionRing}
            emissive={QUANTUM_COLORS.diffractionRing}
            emissiveIntensity={0.45}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0, 0, 0.015]}>
          <torusGeometry args={[ringOuter, 0.016, 8, 32]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.diffractionRing}
            emissive={QUANTUM_COLORS.diffractionRing}
            emissiveIntensity={0.35}
            roughness={0.25}
          />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[-1.16, 0.94, 0]}
      >
        <span>{parts.electronGun}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[-0.6, 0.94, 0.16]}
      >
        <span>{parts.matterWave}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[-0.1, 0.98, 0]}
      >
        <span>{parts.graphiteTarget}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[1.1, 1.14, 0]}
      >
        <span>
          {parts.screen} / {parts.diffractionRings}
        </span>
      </ThreeLabel>
    </group>
  );
}
