import { useFrame, useThree } from "@react-three/fiber";
import type { RectifierMode } from "@repo/design-system/components/contents/physics/rectifier/model";
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
import { useRef } from "react";
import type { Mesh } from "three";

const BRIDGE_DIODES = [
  { id: "d1", rot: Math.PI / 4, x: -0.22, z: -0.18 },
  { id: "d2", rot: -Math.PI / 4, x: 0.22, z: -0.18 },
  { id: "d3", rot: -Math.PI / 4, x: -0.22, z: 0.18 },
  { id: "d4", rot: Math.PI / 4, x: 0.22, z: 0.18 },
] as const;

function RectifierCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 2.25, 3.65] : [0, 1.8, 2.95]}
      cameraTarget={[0, 0.36, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.4}
    />
  );
}

export function RectifierScene({
  frequency,
  mode,
  parts,
}: {
  readonly frequency: number;
  readonly mode: RectifierMode;
  readonly parts: Readonly<
    Record<
      | "acSource"
      | "capacitor"
      | "diodeBridge"
      | "loadResistor"
      | "oscilloscope",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const pulseRef = useRef<Mesh>(null);
  const phaseRef = useRef(0);

  useFrame((_, delta) => {
    if (!playing || pulseRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * (1.8 + frequency * 0.03);
    const t = (phaseRef.current % (Math.PI * 2)) / (Math.PI * 2);
    pulseRef.current.position.x = -1.1 + t * 2.2;
  });

  const bridgeDiodes =
    mode === "halfWave" ? Arr.take(BRIDGE_DIODES, 1) : BRIDGE_DIODES;

  return (
    <group>
      <SimulationTicker running={playing} />
      <RectifierCamera />
      {/* Circuit breadboard base */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[2.8, 0.08, 1.3]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.benchSlate}
          roughness={0.68}
        />
      </mesh>
      {/* AC generator */}
      <mesh castShadow position={[-1.08, 0.28, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.4, 24]} />
        <meshStandardMaterial color={QUANTUM_COLORS.acWave} roughness={0.42} />
      </mesh>
      {/* Diode bridge / single diode */}
      <group position={[-0.24, 0.22, 0]}>
        {Arr.map(bridgeDiodes, (diode) => (
          <group
            key={diode.id}
            position={[diode.x, 0, diode.z]}
            rotation={[0, diode.rot, Math.PI / 2]}
          >
            <mesh castShadow>
              <cylinderGeometry args={[0.065, 0.065, 0.24, 14]} />
              <meshStandardMaterial
                color={QUANTUM_COLORS.diodeBody}
                roughness={0.4}
              />
            </mesh>
            <mesh position={[0, 0.07, 0]}>
              <cylinderGeometry args={[0.068, 0.068, 0.04, 14]} />
              <meshStandardMaterial
                color={QUANTUM_COLORS.diodeBand}
                roughness={0.35}
              />
            </mesh>
          </group>
        ))}
      </group>
      {/* Smoothing capacitor (active in smoothed mode) */}
      <mesh castShadow position={[0.42, 0.3, -0.26]}>
        <cylinderGeometry args={[0.13, 0.13, 0.44, 20]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.capacitorBody}
          opacity={mode === "smoothed" ? 1 : 0.32}
          roughness={0.35}
          transparent={mode !== "smoothed"}
        />
      </mesh>
      {/* Load resistor */}
      <mesh
        castShadow
        position={[0.56, 0.22, 0.26]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.08, 0.08, 0.42, 16]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.resistorBody}
          roughness={0.5}
        />
      </mesh>
      {/* Bench oscilloscope */}
      <group position={[1.1, 0.34, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.48, 0.52, 0.52]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.cavityBody}
            roughness={0.48}
          />
        </mesh>
        <mesh position={[-0.25, 0.04, 0]}>
          <boxGeometry args={[0.02, 0.32, 0.36]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.screenGlow}
            roughness={0.25}
          />
        </mesh>
      </group>
      {/* Moving current pulse bead */}
      <mesh position={[-1.1, 0.22, 0]} ref={pulseRef}>
        <sphereGeometry args={[0.055, 12, 10]} />
        <meshStandardMaterial color={QUANTUM_COLORS.dcWave} roughness={0.3} />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[-1.08, 0.64, 0]}
      >
        <span>{parts.acSource}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[-0.24, 0.56, 0]}
      >
        <span>{parts.diodeBridge}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[0.42, 0.68, -0.26]}
      >
        <span>{parts.capacitor}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[0.56, 0.46, 0.42]}
      >
        <span>{parts.loadResistor}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[1.1, 0.74, 0]}
      >
        <span>{parts.oscilloscope}</span>
      </ThreeLabel>
    </group>
  );
}
