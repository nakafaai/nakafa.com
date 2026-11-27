import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  ANODE_X,
  BEAKER_Z,
  CATHODE_X,
  Circuit,
  ElectrodeAssembly,
  HalfCellBeaker,
  InvertedUTubeBridge,
  LEFT_BEAKER_X,
  LEFT_LEAD,
  METER_Z,
  RIGHT_BEAKER_X,
  RIGHT_LEAD,
  SALT_BRIDGE,
} from "@repo/design-system/components/contents/chemistry/bridge/apparatus";
import type { GalvanicCell } from "@repo/design-system/components/contents/chemistry/bridge/model";
import { evaluateGalvanicCell } from "@repo/design-system/components/contents/chemistry/bridge/model";
import { BENCH_LABEL } from "@repo/design-system/components/contents/chemistry/label";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { Mote } from "@repo/design-system/components/three/apparatus/mote";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import {
  placeOn,
  pointOn,
  trackOf,
} from "@repo/design-system/components/three/form/path";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr, Match } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

/** The salt bridge and the two test leads as measured tracks the ions and electrons ride. */
const BRIDGE_TRACK = trackOf(SALT_BRIDGE);
const LEFT_TRACK = trackOf(LEFT_LEAD);
const RIGHT_TRACK = trackOf(RIGHT_LEAD);

/**
 * What the camera frames, in metres: the upright face of the cell, from
 * tile to tile and from the bench to the names over its leads. The voltmeter
 * stands in front of that face and lower than it, so the face reaches below
 * the bench by as much as the meter's foot shows under it from the camera.
 */
const FRAME = {
  x: { max: 0.26, min: -0.26 },
  y: { max: 0.28, min: -0.1 },
  z: { max: 0.1, min: 0.02 },
};

const ION_COUNT = 3;
const ELECTRON_PER_LEAD = 3;

/** The camera looks down on the cell from the front and stands as near as holds all of it, whatever the frame's shape. */
function BridgeCamera() {
  return (
    <CameraControls
      cameraPosition={[0, 0.3, 0.88]}
      cameraTarget={[0, 0.11, 0.1]}
      fov={37}
      framing="content"
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
      leftStrength: 3,
      rightLiquid: REAGENT_COLORS.copperSulfate,
      rightStrength: 20,
    })),
    Match.when("copperSilver", () => ({
      anodeColor: INSTRUMENT_COLORS.copper,
      cathodeColor: INSTRUMENT_COLORS.silver,
      leftLiquid: REAGENT_COLORS.copperSulfate,
      leftStrength: 20,
      rightLiquid: REAGENT_COLORS.solution,
      rightStrength: 3,
    })),
    Match.when("magnesiumCopper", () => ({
      anodeColor: INSTRUMENT_COLORS.aluminium,
      cathodeColor: INSTRUMENT_COLORS.copper,
      leftLiquid: REAGENT_COLORS.solution,
      leftStrength: 3,
      rightLiquid: REAGENT_COLORS.copperSulfate,
      rightStrength: 20,
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

  const leftElectronRefs = useRef<(Group | null)[]>([]);
  const rightElectronRefs = useRef<(Group | null)[]>([]);
  const cationRefs = useRef<(Group | null)[]>([]);
  const anionRefs = useRef<(Group | null)[]>([]);
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
      }
      const rightMesh = rightElectronRefs.current[i];
      if (rightMesh !== null && rightMesh !== undefined) {
        placeOn(RIGHT_TRACK, t, rightMesh.position);
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
      <CameraBounds exclude>
        <LabBench width={2.8} />
      </CameraBounds>

      <CameraBounds bounds={FRAME}>
        {/* Left (anode) and right (cathode) borosilicate half-cell beakers */}
        <HalfCellBeaker
          liquidColor={visuals.leftLiquid}
          strength={visuals.leftStrength}
          x={LEFT_BEAKER_X}
        />
        <HalfCellBeaker
          liquidColor={visuals.rightLiquid}
          strength={visuals.rightStrength}
          x={RIGHT_BEAKER_X}
        />

        {/* Brushed metal electrodes with crocodile clips */}
        <ElectrodeAssembly metalColor={visuals.anodeColor} x={ANODE_X} />
        <ElectrodeAssembly metalColor={visuals.cathodeColor} x={CATHODE_X} />

        {/* Inverted borosilicate U-tube salt bridge */}
        <InvertedUTubeBridge />

        {/* Benchtop sloped analog voltmeter & curved test leads */}
        <Circuit emfVolts={spec.emfVolts} />

        {/* Glowing golden electrons streaming anode -> voltmeter -> cathode */}
        {Arr.map(electronSlots, (idx) => {
          const t = (idx + 0.5) / ELECTRON_PER_LEAD;
          const leftPt = pointOn(LEFT_TRACK, t);
          const rightPt = pointOn(RIGHT_TRACK, t);
          return (
            <group key={`e-${idx}`}>
              <Mote
                color={PROCESS_COLORS.electronGold}
                core={0.34}
                position={[leftPt[0], leftPt[1], leftPt[2]]}
                radius={0.0085}
                ref={(el) => {
                  leftElectronRefs.current[idx] = el;
                }}
              />
              <Mote
                color={PROCESS_COLORS.electronGold}
                core={0.34}
                position={[rightPt[0], rightPt[1], rightPt[2]]}
                radius={0.0085}
                ref={(el) => {
                  rightElectronRefs.current[idx] = el;
                }}
              />
            </group>
          );
        })}

        {/* Glowing green cations migrating right & amber anions migrating left inside U-tube */}
        {Arr.map(ionSlots, (idx) => {
          const cationPt = pointOn(BRIDGE_TRACK, (idx + 0.5) / ION_COUNT);
          const anionPt = pointOn(BRIDGE_TRACK, 1 - (idx + 0.2) / ION_COUNT);
          return (
            <group key={`ion-${idx}`}>
              <Mote
                color={PROCESS_COLORS.greenProduct}
                core={0.5}
                position={[
                  cationPt[0],
                  cationPt[1] + 0.002,
                  cationPt[2] + 0.003,
                ]}
                radius={0.0062}
                ref={(el) => {
                  cationRefs.current[idx] = el;
                }}
              />
              <Mote
                color={PROCESS_COLORS.oleumAmber}
                core={0.5}
                position={[anionPt[0], anionPt[1] - 0.002, anionPt[2] - 0.003]}
                radius={0.0062}
                ref={(el) => {
                  anionRefs.current[idx] = el;
                }}
              />
            </group>
          );
        })}

        {/* Adaptive labels */}
        <ThreeLabel
          color={labelInk}
          {...BENCH_LABEL}
          position={[0.16, 0.02, METER_Z + 0.09]}
        >
          <span>
            {parts.voltmeter}
            <br />
            {spec.emfVolts.toFixed(2)} V
          </span>
        </ThreeLabel>
        <ThreeLabel
          color={labelInk}
          {...BENCH_LABEL}
          position={[0, 0.265, 0.1]}
        >
          <span>{parts.electronWire}</span>
        </ThreeLabel>
        <ThreeLabel
          color={labelInk}
          {...BENCH_LABEL}
          position={[-0.2, 0.265, BEAKER_Z]}
        >
          <span>
            {parts.anode} ({spec.anodeSymbol})
          </span>
        </ThreeLabel>
        <ThreeLabel
          color={labelInk}
          {...BENCH_LABEL}
          position={[0.2, 0.265, BEAKER_Z]}
        >
          <span>
            {parts.cathode} ({spec.cathodeSymbol})
          </span>
        </ThreeLabel>
        <ThreeLabel
          color={labelInk}
          {...BENCH_LABEL}
          position={[0, 0.192, BEAKER_Z]}
        >
          <span>{parts.saltBridge}</span>
        </ThreeLabel>
        <ThreeLabel
          color={labelInk}
          {...BENCH_LABEL}
          position={[-0.16, 0.02, METER_Z + 0.09]}
        >
          <span>{parts.electrolyte}</span>
        </ThreeLabel>
      </CameraBounds>
    </group>
  );
}
