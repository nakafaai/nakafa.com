import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { RectifierMode } from "@repo/design-system/components/contents/physics/rectifier/model";
import { rectifiedOutput } from "@repo/design-system/components/contents/physics/rectifier/model";
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
import { useEffect, useMemo, useRef } from "react";
import type { Mesh } from "three";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

const BRIDGE_DIODES = [
  { id: "d1", rot: Math.PI / 4, x: -0.18, z: -0.16 },
  { id: "d2", rot: -Math.PI / 4, x: 0.18, z: -0.16 },
  { id: "d3", rot: -Math.PI / 4, x: -0.18, z: 0.16 },
  { id: "d4", rot: Math.PI / 4, x: 0.18, z: 0.16 },
] as const;

const PCB_STANDOFFS = [
  [-1.24, -0.54],
  [1.24, -0.54],
  [-1.24, 0.54],
  [1.24, 0.54],
] as const;

const RESISTOR_BANDS = [
  { color: QUANTUM_COLORS.resistorBand1, y: -0.09 },
  { color: QUANTUM_COLORS.resistorBand2, y: -0.03 },
  { color: QUANTUM_COLORS.resistorBand3, y: 0.03 },
  { color: QUANTUM_COLORS.resistorBand4, y: 0.1 },
] as const;

function createScopeTrace(
  mode: RectifierMode,
  frequency: number
): TubeGeometry {
  const cycles = 1.5 + ((frequency - 20) / 100) * 3.5;
  const points = Arr.makeBy(72, (index) => {
    const u = index / 71;
    const phase = u * Math.PI * 2 * cycles;
    const val = rectifiedOutput(mode, phase);
    return new Vector3(0, -0.08 + val * 0.18, (u - 0.5) * 0.34);
  });
  return new TubeGeometry(new CatmullRomCurve3(points), 72, 0.006, 8, false);
}

function RectifierCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 2.55, 4.65] : [0, 2.1, 4.2]}
      cameraTarget={[0.04, 0.34, 0]}
      fov={36}
      maxDistance={6.8}
      minDistance={1.5}
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
  const ink = useLabelInk();
  const pulseRef = useRef<Mesh>(null);
  const phaseRef = useRef(0);

  const scopeTrace = useMemo(
    () => createScopeTrace(mode, frequency),
    [frequency, mode]
  );
  useEffect(() => () => scopeTrace.dispose(), [scopeTrace]);

  useVisualStop(() => {
    phaseRef.current = 0;
    if (pulseRef.current !== null) {
      pulseRef.current.position.x = -0.82;
    }
  });

  useFrame((_, delta) => {
    if (!playing || pulseRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * (1.8 + frequency * 0.035);
    const t = (phaseRef.current % (Math.PI * 2)) / (Math.PI * 2);
    pulseRef.current.position.x = -0.82 + t * 1.64;
  });

  const bridgeDiodes =
    mode === "halfWave" ? Arr.take(BRIDGE_DIODES, 1) : BRIDGE_DIODES;
  const knobAngle = -((frequency - 20) / 100) * Math.PI * 1.5;

  return (
    <group>
      <SimulationTicker running={playing} />
      <RectifierCamera />

      {/* Satin dark epoxy workbench */}
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <boxGeometry args={[3.4, 0.08, 2.0]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.benchEpoxy}
          roughness={0.62}
        />
      </mesh>

      {/* FR-4 green solder-mask PCB on brass hex standoffs */}
      {Arr.map(PCB_STANDOFFS, ([sx, sz]) => (
        <mesh key={`${sx}-${sz}`} position={[sx, 0.04, sz]}>
          <cylinderGeometry args={[0.025, 0.025, 0.08, 6]} />
          <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.3} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.095, 0]} receiveShadow>
        <boxGeometry args={[2.76, 0.04, 1.24]} />
        <meshPhysicalMaterial
          clearcoat={0.45}
          clearcoatRoughness={0.28}
          color={QUANTUM_COLORS.pcbBoard}
          roughness={0.38}
        />
      </mesh>
      {/* Etched copper/solder PCB circuit rails */}
      {Arr.map([-0.24, 0.24] as const, (rz) => (
        <mesh key={rz} position={[0, 0.117, rz]}>
          <boxGeometry args={[2.1, 0.005, 0.024]} />
          <MetalMaterial color={QUANTUM_COLORS.pcbTrace} roughness={0.3} />
        </mesh>
      ))}

      {/* Bench AC Function Generator with live rotating frequency dial */}
      <group position={[-1.08, 0.3, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.48, 0.38, 0.56]} />
          <MetalMaterial color={QUANTUM_COLORS.furnaceSteel} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.02, 0.282]}>
          <boxGeometry args={[0.42, 0.3, 0.012]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.crtBezel}
            roughness={0.45}
          />
        </mesh>
        {/* Rotary frequency tuning dial */}
        <group position={[-0.08, 0.03, 0.305]} rotation={[0, 0, knobAngle]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.085, 0.04, 24]} />
            <MetalMaterial color={QUANTUM_COLORS.aluminium} roughness={0.28} />
          </mesh>
          <mesh position={[0, 0.048, 0.022]}>
            <boxGeometry args={[0.014, 0.048, 0.01]} />
            <meshStandardMaterial
              color={QUANTUM_COLORS.acWave}
              emissive={QUANTUM_COLORS.acWave}
              emissiveIntensity={0.6}
            />
          </mesh>
        </group>
        {/* Red & black BNC/banana output jacks */}
        <mesh position={[0.12, 0.06, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.024, 0.024, 0.03, 16]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.bananaRed}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0.12, -0.05, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.024, 0.024, 0.03, 16]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.bananaBlack}
            roughness={0.4}
          />
        </mesh>
      </group>

      {/* 1N4007 axial silicon rectifier diodes with silver cathode rings & wire leads */}
      <group position={[-0.24, 0.2, 0]}>
        {Arr.map(bridgeDiodes, (diode) => (
          <group
            key={diode.id}
            position={[diode.x, 0, diode.z]}
            rotation={[0, diode.rot, Math.PI / 2]}
          >
            <mesh castShadow>
              <cylinderGeometry args={[0.052, 0.052, 0.2, 20]} />
              <meshPhysicalMaterial
                clearcoat={0.5}
                color={QUANTUM_COLORS.diodeBody}
                roughness={0.32}
              />
            </mesh>
            <mesh position={[0, 0.055, 0]}>
              <cylinderGeometry args={[0.054, 0.054, 0.036, 20]} />
              <MetalMaterial
                color={QUANTUM_COLORS.diodeBand}
                roughness={0.25}
              />
            </mesh>
            {/* Axial wire leads */}
            <mesh>
              <cylinderGeometry args={[0.01, 0.01, 0.34, 10]} />
              <MetalMaterial color={QUANTUM_COLORS.wireLead} roughness={0.25} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Vertical aluminum electrolytic smoothing capacitor */}
      <group position={[0.38, 0.31, -0.26]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.38, 28]} />
          <meshPhysicalMaterial
            clearcoat={0.65}
            color={QUANTUM_COLORS.capacitorBody}
            opacity={mode === "smoothed" ? 1 : 0.28}
            roughness={0.28}
            transparent={mode !== "smoothed"}
          />
        </mesh>
        {/* Brushed aluminum scored top vent cap */}
        <mesh position={[0, 0.192, 0]}>
          <cylinderGeometry args={[0.112, 0.112, 0.01, 24]} />
          <MetalMaterial
            color={QUANTUM_COLORS.capacitorVent}
            roughness={0.22}
          />
        </mesh>
        {/* Polarity stripe */}
        <mesh position={[0, 0, 0.115]}>
          <boxGeometry args={[0.04, 0.34, 0.014]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.capacitorStripe}
            opacity={mode === "smoothed" ? 1 : 0.28}
            roughness={0.4}
            transparent={mode !== "smoothed"}
          />
        </mesh>
      </group>

      {/* Ceramic axial power load resistor with 4 EIA color bands */}
      <group position={[0.42, 0.2, 0.25]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.068, 0.068, 0.34, 24]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.resistorBody}
            roughness={0.46}
          />
        </mesh>
        {Arr.map(RESISTOR_BANDS, (band) => (
          <mesh key={band.y} position={[0, band.y, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.026, 24]} />
            <meshStandardMaterial color={band.color} roughness={0.35} />
          </mesh>
        ))}
        <mesh>
          <cylinderGeometry args={[0.012, 0.012, 0.5, 10]} />
          <MetalMaterial color={QUANTUM_COLORS.wireLead} roughness={0.25} />
        </mesh>
      </group>

      {/* Bench CRT Oscilloscope with live frequency-coupled glowing waveform trace */}
      <group position={[1.12, 0.36, 0.04]} rotation={[0, 0.68, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.5, 0.48, 0.56]} />
          <MetalMaterial color={QUANTUM_COLORS.furnaceSteel} roughness={0.42} />
        </mesh>
        <mesh position={[-0.252, 0.02, 0]}>
          <boxGeometry args={[0.018, 0.34, 0.42]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.crtBezel}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[-0.262, 0.02, 0]}>
          <boxGeometry args={[0.008, 0.28, 0.36]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.screenGlow}
            emissive={QUANTUM_COLORS.crtGrid}
            emissiveIntensity={0.65}
            roughness={0.2}
          />
        </mesh>
        {/* Live glowing phosphor waveform trace updating immediately with mode & frequency */}
        <mesh geometry={scopeTrace} position={[-0.27, 0.02, 0]}>
          <meshStandardMaterial
            color={QUANTUM_COLORS.crtTrace}
            emissive={QUANTUM_COLORS.crtTrace}
            emissiveIntensity={1.6}
            roughness={0.2}
          />
        </mesh>
      </group>

      {/* Moving rectified current pulse marker */}
      <mesh position={[-0.82, 0.145, 0.24]} ref={pulseRef}>
        <sphereGeometry args={[0.036, 14, 12]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.dcWave}
          emissive={QUANTUM_COLORS.dcWave}
          emissiveIntensity={0.85}
          roughness={0.22}
        />
      </mesh>

      {/* Compact non-overlapping labels well inside viewport */}
      <ThreeLabel
        color={ink}
        fontSize="compact"
        maximumFontSize={12}
        minimumFontSize={10}
        position={[-1.16, 0.82, 0]}
      >
        <span>{parts.acSource}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        maximumFontSize={12}
        minimumFontSize={10}
        position={[-0.3, 0.42, 0.25]}
      >
        <span>{parts.diodeBridge}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        maximumFontSize={12}
        minimumFontSize={10}
        position={[0.14, 1.02, -0.32]}
      >
        <span>{parts.capacitor}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        maximumFontSize={12}
        minimumFontSize={10}
        position={[0.36, 0.18, 0.64]}
      >
        <span>{parts.loadResistor}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        maximumFontSize={12}
        minimumFontSize={10}
        position={[1.18, 0.78, 0.24]}
      >
        <span>{parts.oscilloscope}</span>
      </ThreeLabel>
    </group>
  );
}
