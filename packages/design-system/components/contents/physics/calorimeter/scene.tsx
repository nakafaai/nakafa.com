import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { CalorimeterMaterial } from "@repo/design-system/components/contents/physics/calorimeter/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { Sweep, Turn } from "@repo/design-system/components/three/form/part";
import type { Path } from "@repo/design-system/components/three/form/path";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr, Match } from "effect";
import { useRef } from "react";
import type { Group } from "three";
import { DoubleSide } from "three";

function sampleColor(material: CalorimeterMaterial): string {
  return Match.value(material).pipe(
    Match.when("water", () => QUANTUM_COLORS.waterLiquid),
    Match.when("aluminium", () => QUANTUM_COLORS.aluminium),
    Match.when("copper", () => QUANTUM_COLORS.copper),
    Match.when("iron", () => QUANTUM_COLORS.iron),
    Match.when("oil", () => QUANTUM_COLORS.oil),
    Match.exhaustive
  );
}

/** The immersion heater: five turns of element up the middle of the cup. */
const HEATER_COIL: Path = {
  from: [0, 0.16, 0],
  kind: "helix",
  radius: 0.055,
  to: [0, 0.58, 0],
  turns: 5,
};

/** The stirrer: a rod down through the lid, bent into a loop at its foot. */
const STIRRER: Path = [
  [0, 1.06, 0],
  [0, 0.24, 0],
  [0.06, 0.19, 0.04],
  [0, 0.19, 0.11],
  [-0.07, 0.19, 0.04],
  [-0.04, 0.19, -0.05],
  [0, 0.22, 0],
];

/** The spun copper inner cup, as the outline of its wall and base. */
const INNER_CUP = [
  [0, 0.08],
  [0.44, 0.08],
  [0.46, 0.1],
  [0.46, 0.78],
  [0.49, 0.81],
  [0.47, 0.82],
  [0.44, 0.78],
  [0.44, 0.11],
  [0, 0.11],
] as const;

/** The cup's cutaway: the front quarter left open to see inside. */
const CUP_ARC = [0.76, Math.PI * 1.48] as const;

function CalorimeterCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [2.05, 1.95, 4.05] : [1.45, 1.38, 2.75]}
      cameraTarget={[0, 0.58, 0]}
      fov={36}
      maxDistance={6.2}
      minDistance={1.4}
    />
  );
}

const THERMOMETER_TICKS = Arr.makeBy(8, (i) => 0.14 + i * 0.085);

export function CalorimeterScene({
  massKg = 0.8,
  material,
  parts,
  powerW = 120,
  temperatureRiseK,
}: {
  readonly massKg?: number;
  readonly material: CalorimeterMaterial;
  readonly parts: Readonly<
    Record<
      "heater" | "insulation" | "sample" | "stirrer" | "thermometer",
      string
    >
  >;
  readonly powerW?: number;
  readonly temperatureRiseK: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const stirrerRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  useVisualStop(() => {
    phaseRef.current = 0;
    if (stirrerRef.current !== null) {
      stirrerRef.current.position.y = 0;
    }
  });

  useFrame((_, delta) => {
    if (!playing || stirrerRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 3.4;
    stirrerRef.current.position.y = Math.sin(phaseRef.current) * 0.075;
  });

  const isLiquid = material === "water" || material === "oil";
  const fillHeight = 0.24 + Math.min(0.42, (massKg / 2) * 0.42);
  const heaterGlow = 0.2 + Math.min(1.6, (powerW / 200) * 1.45);
  const mercuryHeight = 0.16 + Math.min(0.68, temperatureRiseK / 85);

  return (
    <group>
      <SimulationTicker running={playing} />
      <CalorimeterCamera />

      {/* Satin laboratory epoxy benchtop pad */}
      <mesh position={[0, -0.03, 0]} receiveShadow>
        <boxGeometry args={[2.5, 0.06, 1.7]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.benchEpoxy}
          roughness={0.62}
        />
      </mesh>
      <mesh position={[0, -0.002, -0.84]}>
        <boxGeometry args={[2.5, 0.055, 0.024]} />
        <MetalMaterial color={QUANTUM_COLORS.benchTrim} roughness={0.35} />
      </mesh>

      {/* Outer brushed-aluminum Dewar calorimeter cutaway jacket */}
      <mesh castShadow position={[0, 0.44, 0]} receiveShadow>
        <cylinderGeometry
          args={[0.64, 0.65, 0.84, 48, 1, true, 0.72, Math.PI * 1.56]}
        />
        <MetalMaterial color={QUANTUM_COLORS.aluminium} roughness={0.34} />
      </mesh>
      {/* White insulating foam liner visible inside the cutaway */}
      <mesh position={[0, 0.43, 0]}>
        <cylinderGeometry
          args={[0.58, 0.58, 0.8, 44, 1, true, 0.74, Math.PI * 1.52]}
        />
        <meshStandardMaterial
          color={QUANTUM_COLORS.dewarFoam}
          roughness={0.92}
          side={DoubleSide}
        />
      </mesh>
      {/* Heavy flanged aluminum base foot */}
      <mesh castShadow position={[0, 0.04, 0]} receiveShadow>
        <cylinderGeometry args={[0.67, 0.7, 0.08, 48]} />
        <MetalMaterial color={QUANTUM_COLORS.benchSlate} roughness={0.44} />
      </mesh>
      <mesh position={[0, 0.86, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.64, 0.016, 12, 48]} />
        <MetalMaterial color={QUANTUM_COLORS.aluminium} roughness={0.28} />
      </mesh>

      {/* Spun copper inner calorimeter vessel (cutaway front for inspection) */}
      <mesh castShadow position={[0, 0, 0]}>
        <Turn arc={CUP_ARC} profile={INNER_CUP} />
        <MetalMaterial color={QUANTUM_COLORS.copper} roughness={0.24} />
      </mesh>

      {/* Sample liquid or machined metallic block (height responds to mass slider) */}
      <mesh castShadow position={[0, 0.11 + fillHeight / 2, 0]}>
        <cylinderGeometry args={[0.425, 0.425, fillHeight, 44]} />
        {isLiquid ? (
          <LiquidMaterial color={sampleColor(material)} opacity={0.74} />
        ) : (
          <MetalMaterial color={sampleColor(material)} roughness={0.28} />
        )}
      </mesh>

      {/* Insulated cork lid with cutaway front quadrant */}
      <mesh castShadow position={[0, 0.86, 0]}>
        <cylinderGeometry
          args={[0.63, 0.61, 0.055, 48, 1, false, 0.72, Math.PI * 1.56]}
        />
        <meshStandardMaterial color={QUANTUM_COLORS.cork} roughness={0.86} />
      </mesh>

      {/* Helical nichrome immersion heater coil + ceramic terminal posts */}
      <group position={[-0.2, 0, -0.02]}>
        <mesh castShadow>
          <Sweep ends="round" path={HEATER_COIL} radius={0.011} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.heaterCoil}
            emissive={QUANTUM_COLORS.heaterCoil}
            emissiveIntensity={heaterGlow}
            metalness={0.5}
            roughness={0.32}
          />
        </mesh>
        {Arr.map([-0.045, 0.045] as const, (dx) => (
          <group key={dx} position={[dx, 0.74, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.016, 0.016, 0.4, 14]} />
              <MetalMaterial
                color={QUANTUM_COLORS.anodeSteel}
                roughness={0.28}
              />
            </mesh>
            <mesh position={[0, 0.22, 0]}>
              <cylinderGeometry args={[0.032, 0.032, 0.06, 16]} />
              <meshStandardMaterial
                color={
                  dx < 0 ? QUANTUM_COLORS.bananaRed : QUANTUM_COLORS.bananaBlack
                }
                roughness={0.42}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Graduated borosilicate mercury thermometer with live rising column */}
      <group position={[0.21, 0.64, -0.02]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.028, 0.028, 0.96, 20]} />
          <GlassMaterial color={QUANTUM_COLORS.glassTube} opacity={0.34} />
        </mesh>
        <mesh position={[0, -0.49, 0]}>
          <sphereGeometry args={[0.042, 20, 16]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.mercuryLiquid}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, -0.45 + mercuryHeight / 2, 0]}>
          <cylinderGeometry args={[0.013, 0.013, mercuryHeight, 12]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.mercuryLiquid}
            emissive={QUANTUM_COLORS.mercuryLiquid}
            emissiveIntensity={0.25}
            roughness={0.25}
          />
        </mesh>
        {Arr.map(THERMOMETER_TICKS, (ty) => (
          <mesh key={ty} position={[0.029, ty - 0.36, 0]}>
            <boxGeometry args={[0.004, 0.008, 0.022]} />
            <meshStandardMaterial
              color={QUANTUM_COLORS.dialInk}
              roughness={0.5}
            />
          </mesh>
        ))}
      </group>

      {/* Brass looped stirrer with wooden knob */}
      <group position={[0, 0, 0.16]} ref={stirrerRef}>
        <mesh castShadow>
          <Sweep ends="round" path={STIRRER} radius={0.011} />
          <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.26} />
        </mesh>
        <mesh castShadow position={[0, 1.09, 0]}>
          <sphereGeometry args={[0.044, 18, 14]} />
          <meshStandardMaterial color={QUANTUM_COLORS.cork} roughness={0.74} />
        </mesh>
      </group>

      {/* Crisp compact non-overlapping labels */}
      <ThreeLabel color={ink} fontSize="compact" position={[-0.88, 0.98, 0]}>
        <span>{parts.heater}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.78, 1.12, 0]}>
        <span>{parts.thermometer}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.18, 1.24, 0.24]}>
        <span>{parts.stirrer}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.96, 0.44, 0.18]}>
        <span>{parts.insulation}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.92, 0.38, 0.18]}>
        <span>{parts.sample}</span>
      </ThreeLabel>
    </group>
  );
}
