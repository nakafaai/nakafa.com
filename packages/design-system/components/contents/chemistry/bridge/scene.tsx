import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  ANODE_X,
  BEAKER_Z,
  CATHODE_X,
  ElectrodeAssembly,
  HalfCellBeaker,
  InvertedUTubeBridge,
  LEFT_BEAKER_X,
  RIGHT_BEAKER_X,
  SALT_BRIDGE,
} from "@repo/design-system/components/contents/chemistry/bridge/apparatus";
import {
  BenchVoltmeter,
  CurvedTestLeads,
  LEFT_LEAD,
  METER_Z,
  RIGHT_LEAD,
} from "@repo/design-system/components/contents/chemistry/bridge/meter";
import type { GalvanicCell } from "@repo/design-system/components/contents/chemistry/bridge/model";
import { evaluateGalvanicCell } from "@repo/design-system/components/contents/chemistry/bridge/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import {
  placeOn,
  pointOn,
  trackOf,
} from "@repo/design-system/components/three/form/path";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr, Match } from "effect";
import { useMemo, useRef } from "react";
import type { Mesh } from "three";

/** The salt bridge and the two test leads as measured tracks the ions and electrons ride. */
const BRIDGE_TRACK = trackOf(SALT_BRIDGE);
const LEFT_TRACK = trackOf(LEFT_LEAD);
const RIGHT_TRACK = trackOf(RIGHT_LEAD);

const ION_COUNT = 3;
const ELECTRON_PER_LEAD = 3;

function BridgeCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 0.36, 1.2] : [0, 0.3, 0.88]}
      cameraTarget={[0, 0.145, 0]}
      fov={37}
      maxDistance={2.4}
      minDistance={0.4}
    />
  );
}

function cellVisuals(cell: GalvanicCell) {
  return Match.value(cell).pipe(
    Match.when("daniell", () => ({
      anodeColor: PROCESS_COLORS.anodeZinc,
      cathodeColor: INSTRUMENT_COLORS.copper,
      leftLiquid: REAGENT_COLORS.solution,
      leftOpacity: 0.48,
      rightLiquid: REAGENT_COLORS.copperSulfate,
      rightOpacity: 0.68,
    })),
    Match.when("copperSilver", () => ({
      anodeColor: INSTRUMENT_COLORS.copper,
      cathodeColor: INSTRUMENT_COLORS.silver,
      leftLiquid: REAGENT_COLORS.copperSulfate,
      leftOpacity: 0.62,
      rightLiquid: REAGENT_COLORS.solution,
      rightOpacity: 0.42,
    })),
    Match.when("magnesiumCopper", () => ({
      anodeColor: INSTRUMENT_COLORS.aluminium,
      cathodeColor: INSTRUMENT_COLORS.copper,
      leftLiquid: REAGENT_COLORS.solution,
      leftOpacity: 0.44,
      rightLiquid: REAGENT_COLORS.copperSulfate,
      rightOpacity: 0.68,
    })),
    Match.exhaustive
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
  const invalidate = useThree((state) => state.invalidate);
  const labelInk = useLabelInk();

  const leftElectronRefs = useRef<(Mesh | null)[]>([]);
  const rightElectronRefs = useRef<(Mesh | null)[]>([]);
  const cationRefs = useRef<(Mesh | null)[]>([]);
  const anionRefs = useRef<(Mesh | null)[]>([]);
  const phaseRef = useRef(0);

  const spec = evaluateGalvanicCell(cell);
  const visuals = cellVisuals(cell);

  const ionSlots = useMemo(() => Arr.makeBy(ION_COUNT, (idx) => idx), []);
  const electronSlots = useMemo(
    () => Arr.makeBy(ELECTRON_PER_LEAD, (idx) => idx),
    []
  );

  const positionParticles = (phase: number) => {
    for (let i = 0; i < ELECTRON_PER_LEAD; i += 1) {
      const t = (phase * 0.55 + (i + 0.5) / ELECTRON_PER_LEAD) % 1;
      const leftMesh = leftElectronRefs.current[i];
      if (leftMesh !== null && leftMesh !== undefined) {
        placeOn(LEFT_TRACK, t, leftMesh.position);
        leftMesh.position.z += 0.005;
      }
      const rightMesh = rightElectronRefs.current[i];
      if (rightMesh !== null && rightMesh !== undefined) {
        placeOn(RIGHT_TRACK, t, rightMesh.position);
        rightMesh.position.z += 0.005;
      }
    }
    for (let i = 0; i < ION_COUNT; i += 1) {
      const cationT = (phase * 0.36 + (i + 0.5) / ION_COUNT) % 1;
      const cationMesh = cationRefs.current[i];
      if (cationMesh !== null && cationMesh !== undefined) {
        placeOn(BRIDGE_TRACK, cationT, cationMesh.position);
        cationMesh.position.y += 0.002;
        cationMesh.position.z += 0.003;
      }
      const anionT = 1 - ((phase * 0.36 + (i + 0.2) / ION_COUNT) % 1);
      const anionMesh = anionRefs.current[i];
      if (anionMesh !== null && anionMesh !== undefined) {
        placeOn(BRIDGE_TRACK, anionT, anionMesh.position);
        anionMesh.position.y -= 0.002;
        anionMesh.position.z -= 0.003;
      }
    }
  };

  useVisualStop(() => {
    phaseRef.current = 0;
    positionParticles(0);
    invalidate();
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * spec.electronSpeed;
    positionParticles(phaseRef.current);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <BridgeCamera />
      <LabBench width={2.8} />

      {/* Left (anode) and right (cathode) borosilicate half-cell beakers */}
      <HalfCellBeaker
        liquidColor={visuals.leftLiquid}
        liquidOpacity={visuals.leftOpacity}
        x={LEFT_BEAKER_X}
      />
      <HalfCellBeaker
        liquidColor={visuals.rightLiquid}
        liquidOpacity={visuals.rightOpacity}
        x={RIGHT_BEAKER_X}
      />

      {/* Brushed metal electrodes with crocodile clips */}
      <ElectrodeAssembly
        clipColor={BENCH_COLORS.leadBlack}
        metalColor={visuals.anodeColor}
        x={ANODE_X}
      />
      <ElectrodeAssembly
        clipColor={BENCH_COLORS.leadRed}
        metalColor={visuals.cathodeColor}
        x={CATHODE_X}
      />

      {/* Inverted borosilicate U-tube salt bridge */}
      <InvertedUTubeBridge />

      {/* Benchtop sloped analog voltmeter & curved test leads */}
      <BenchVoltmeter emfVolts={spec.emfVolts} />
      <CurvedTestLeads />

      {/* Glowing golden electrons streaming anode -> voltmeter -> cathode */}
      {Arr.map(electronSlots, (idx) => {
        const t = (idx + 0.5) / ELECTRON_PER_LEAD;
        const leftPt = pointOn(LEFT_TRACK, t);
        const rightPt = pointOn(RIGHT_TRACK, t);
        return (
          <group key={`e-${idx}`}>
            <mesh
              position={[leftPt[0], leftPt[1], leftPt[2] + 0.005]}
              ref={(el) => {
                leftElectronRefs.current[idx] = el;
              }}
            >
              <sphereGeometry args={[0.0054, 12, 10]} />
              <meshStandardMaterial
                color={PROCESS_COLORS.electronGold}
                emissive={PROCESS_COLORS.electronGold}
                emissiveIntensity={0.95}
              />
            </mesh>
            <mesh
              position={[rightPt[0], rightPt[1], rightPt[2] + 0.005]}
              ref={(el) => {
                rightElectronRefs.current[idx] = el;
              }}
            >
              <sphereGeometry args={[0.0054, 12, 10]} />
              <meshStandardMaterial
                color={PROCESS_COLORS.electronGold}
                emissive={PROCESS_COLORS.electronGold}
                emissiveIntensity={0.95}
              />
            </mesh>
          </group>
        );
      })}

      {/* Glowing green cations migrating right & amber anions migrating left inside U-tube */}
      {Arr.map(ionSlots, (idx) => {
        const cationPt = pointOn(BRIDGE_TRACK, (idx + 0.5) / ION_COUNT);
        const anionPt = pointOn(BRIDGE_TRACK, 1 - (idx + 0.2) / ION_COUNT);
        return (
          <group key={`ion-${idx}`}>
            <mesh
              position={[cationPt[0], cationPt[1] + 0.002, cationPt[2] + 0.003]}
              ref={(el) => {
                cationRefs.current[idx] = el;
              }}
            >
              <sphereGeometry args={[0.0046, 12, 10]} />
              <meshStandardMaterial
                color={PROCESS_COLORS.greenProduct}
                emissive={PROCESS_COLORS.greenProduct}
                emissiveIntensity={0.85}
              />
            </mesh>
            <mesh
              position={[anionPt[0], anionPt[1] - 0.002, anionPt[2] - 0.003]}
              ref={(el) => {
                anionRefs.current[idx] = el;
              }}
            >
              <sphereGeometry args={[0.0046, 12, 10]} />
              <meshStandardMaterial
                color={PROCESS_COLORS.oleumAmber}
                emissive={PROCESS_COLORS.oleumAmber}
                emissiveIntensity={0.85}
              />
            </mesh>
          </group>
        );
      })}

      {/* Adaptive labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0, 0.312, METER_Z + 0.02]}
      >
        <span>
          {parts.voltmeter} ({spec.emfVolts.toFixed(2)} V)
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.175, 0.258, -0.01]}
      >
        <span>{parts.electronWire}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.258, 0.142, BEAKER_Z]}
      >
        <span>
          {parts.anode} ({spec.anodeSymbol})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.258, 0.142, BEAKER_Z]}
      >
        <span>
          {parts.cathode} ({spec.cathodeSymbol})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0, 0.128, BEAKER_Z + 0.044]}
      >
        <span>{parts.saltBridge}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[LEFT_BEAKER_X, 0.024, BEAKER_Z + 0.095]}
      >
        <span>{parts.electrolyte}</span>
      </ThreeLabel>
    </group>
  );
}
