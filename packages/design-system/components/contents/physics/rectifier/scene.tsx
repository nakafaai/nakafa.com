import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  Generator,
  Lead,
  Scope,
  Terminal,
} from "@repo/design-system/components/contents/physics/rectifier/bench";
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
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
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
  [-0.8, -0.5],
  [0.8, -0.5],
  [-0.8, 0.5],
  [0.8, 0.5],
] as const;

/** Where the leads land: the board's input pair, its output, and the instruments' posts. */
const LEADS = {
  ground: { from: [-1.22, 0.14, 0.37], to: [-0.7, 0.14, -0.24] },
  live: { from: [-1.22, 0.25, 0.37], to: [-0.7, 0.14, 0.24] },
  probe: { from: [1.02, 0.12, 0.34], to: [0.7, 0.14, 0.24] },
} as const;

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
      cameraPosition={narrow ? [0, 3.05, 5.6] : [0, 2.1, 4.2]}
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
      pulseRef.current.position.x = -0.6;
    }
  });

  useFrame((_, delta) => {
    if (!playing || pulseRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * (1.8 + frequency * 0.035);
    const t = (phaseRef.current % (Math.PI * 2)) / (Math.PI * 2);
    pulseRef.current.position.x = -0.6 + t * 1.2;
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
        <boxGeometry args={[3.6, 0.08, 2.0]} />
        <SurfaceMaterial
          color={QUANTUM_COLORS.benchEpoxy}
          repeat={[6, 4]}
          roughness={0.62}
          surface="plastic"
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
        <boxGeometry args={[1.76, 0.03, 1.14]} />
        <meshPhysicalMaterial
          clearcoat={0.45}
          clearcoatRoughness={0.28}
          color={QUANTUM_COLORS.pcbBoard}
          roughness={0.38}
        />
      </mesh>
      {/* Tinned copper rails the parts are soldered across */}
      {Arr.map([-0.24, 0.24] as const, (rz) => (
        <mesh key={rz} position={[0, 0.112, rz]}>
          <boxGeometry args={[1.4, 0.004, 0.024]} />
          <MetalMaterial color={QUANTUM_COLORS.pcbTrace} roughness={0.3} />
        </mesh>
      ))}
      <Terminal position={LEADS.live.to} />
      <Terminal position={LEADS.ground.to} />
      <Terminal position={LEADS.probe.to} />

      {/* The function generator, beside the board, wired to its input */}
      <group position={[-1.35, 0, 0.1]}>
        <Generator knob={knobAngle} />
      </group>
      <Lead
        color={QUANTUM_COLORS.bananaRed}
        from={LEADS.live.from}
        to={LEADS.live.to}
      />
      <Lead
        color={QUANTUM_COLORS.bananaBlack}
        from={LEADS.ground.from}
        to={LEADS.ground.to}
      />
      <Lead
        color={QUANTUM_COLORS.bananaBlack}
        from={LEADS.probe.from}
        to={LEADS.probe.to}
      />

      {/* 1N4007 axial silicon rectifier diodes with silver cathode rings & wire leads */}
      <group position={[-0.36, 0.172, 0]}>
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
      <group position={[0.2, 0.3, -0.26]}>
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
      <group position={[0.26, 0.18, 0.25]} rotation={[0, 0, Math.PI / 2]}>
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

      {/* The oscilloscope, turned toward the reader, its trace live with mode and frequency */}
      <group position={[1.36, 0, 0]} rotation={[0, 0.68, 0]}>
        <Scope>
          <mesh geometry={scopeTrace}>
            <meshBasicMaterial color={QUANTUM_COLORS.crtTrace} />
          </mesh>
        </Scope>
      </group>

      {/* Moving rectified current pulse marker */}
      <mesh position={[-0.6, 0.135, 0.24]} ref={pulseRef}>
        <sphereGeometry args={[0.024, 16, 12]} />
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
        position={[-1.35, 0.56, 0.1]}
      >
        <span>{parts.acSource}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        maximumFontSize={12}
        minimumFontSize={10}
        position={[-0.36, 0.42, 0]}
      >
        <span>{parts.diodeBridge}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        maximumFontSize={12}
        minimumFontSize={10}
        position={[0.2, 0.68, -0.26]}
      >
        <span>{parts.capacitor}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        maximumFontSize={12}
        minimumFontSize={10}
        position={[0.26, 0.12, 0.72]}
      >
        <span>{parts.loadResistor}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        maximumFontSize={12}
        minimumFontSize={10}
        position={[1.36, 0.68, 0]}
      >
        <span>{parts.oscilloscope}</span>
      </ThreeLabel>
    </group>
  );
}
