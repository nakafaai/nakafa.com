import { useFrame, useThree } from "@react-three/fiber";
import type { GalvanicCell } from "@repo/design-system/components/contents/chemistry/bridge/model";
import { evaluateGalvanicCell } from "@repo/design-system/components/contents/chemistry/bridge/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { useRef } from "react";
import type { Group } from "three";

function BridgeCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.6, 3.55] : [0, 1.35, 2.9]}
      cameraTarget={[0, 0.62, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.5}
    />
  );
}

export function SaltBridgeScene({
  cell,
  parts,
}: {
  readonly cell: GalvanicCell;
  readonly parts: Readonly<
    Record<
      | "anode"
      | "cathode"
      | "electrolyte"
      | "electronWire"
      | "saltBridge"
      | "voltmeter",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const electronRef = useRef<Group>(null);
  const cationRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const spec = evaluateGalvanicCell(cell);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * spec.electronSpeed;
    const t = phaseRef.current % 1;
    if (electronRef.current !== null) {
      electronRef.current.position.set(-0.72 + t * 1.44, 1.18, 0.04);
    }
    if (cationRef.current !== null) {
      cationRef.current.position.set(-0.34 + t * 0.68, 0.72, 0.14);
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <BridgeCamera />
      {/* Left half-cell beaker + electrolyte */}
      <mesh position={[-0.72, 0.34, 0]}>
        <cylinderGeometry args={[0.34, 0.32, 0.64, 20, 1, true]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.glassClear}
          opacity={0.34}
          side={2}
          transparent
        />
      </mesh>
      <mesh position={[-0.72, 0.24, 0]}>
        <cylinderGeometry args={[0.3, 0.29, 0.42, 20]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.coldBlue}
          opacity={0.42}
          transparent
        />
      </mesh>
      {/* Right half-cell beaker + electrolyte */}
      <mesh position={[0.72, 0.34, 0]}>
        <cylinderGeometry args={[0.34, 0.32, 0.64, 20, 1, true]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.glassClear}
          opacity={0.34}
          side={2}
          transparent
        />
      </mesh>
      <mesh position={[0.72, 0.24, 0]}>
        <cylinderGeometry args={[0.3, 0.29, 0.42, 20]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.alkaliBlue}
          opacity={0.55}
          transparent
        />
      </mesh>
      {/* Anode strip (left) and cathode strip (right) */}
      <mesh castShadow position={[-0.78, 0.56, 0]}>
        <boxGeometry args={[0.1, 0.72, 0.16]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.anodeZinc}
          metalness={0.5}
          roughness={0.35}
        />
      </mesh>
      <mesh castShadow position={[0.78, 0.56, 0]}>
        <boxGeometry args={[0.1, 0.72, 0.16]} />
        <meshStandardMaterial
          color={
            cell === "copperSilver"
              ? PROCESS_COLORS.silverChrome
              : PROCESS_COLORS.cathodeCopper
          }
          metalness={0.55}
          roughness={0.3}
        />
      </mesh>
      {/* Inverted U-tube salt bridge */}
      <mesh castShadow position={[0, 0.72, 0]}>
        <boxGeometry args={[0.92, 0.1, 0.1]} />
        <meshStandardMaterial color={PROCESS_COLORS.saltBridgeWhite} />
      </mesh>
      <mesh castShadow position={[-0.46, 0.48, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.48, 12]} />
        <meshStandardMaterial color={PROCESS_COLORS.saltBridgeWhite} />
      </mesh>
      <mesh castShadow position={[0.46, 0.48, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.48, 12]} />
        <meshStandardMaterial color={PROCESS_COLORS.saltBridgeWhite} />
      </mesh>
      {/* External wire and central voltmeter */}
      <mesh position={[0, 1.18, 0]}>
        <boxGeometry args={[1.56, 0.03, 0.03]} />
        <meshStandardMaterial color={PROCESS_COLORS.ironDark} />
      </mesh>
      <mesh castShadow position={[0, 1.18, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.08, 18]} />
        <meshStandardMaterial color={PROCESS_COLORS.catalystTeal} />
      </mesh>
      {/* Moving electron along external wire */}
      <group position={[0, 1.18, 0.04]} ref={electronRef}>
        <mesh>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color={PROCESS_COLORS.electronGold} />
        </mesh>
      </group>
      {/* Migrating salt-bridge cation */}
      <group position={[0, 0.72, 0.14]} ref={cationRef}>
        <mesh>
          <sphereGeometry args={[0.042, 10, 10]} />
          <meshStandardMaterial color={PROCESS_COLORS.greenProduct} />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.42, 0]}
      >
        <span>
          {parts.voltmeter} ({spec.emfVolts.toFixed(2)} V)
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.95, 1.02, 0]}
      >
        <span>
          {parts.anode} ({spec.anodeSymbol})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.95, 1.02, 0]}
      >
        <span>
          {parts.cathode} ({spec.cathodeSymbol})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.88, 0.2]}
      >
        <span>{parts.saltBridge}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 0.14, 0.42]}
      >
        <span>{parts.electrolyte}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.56, 1.32, 0]}
      >
        <span>{parts.electronWire}</span>
      </ThreeLabel>
    </group>
  );
}
