import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  COMPRESSOR_X,
  CONDENSER_X,
  CONVERTER_X,
  CompressorUnit,
  FEED,
  PilotSkid,
  ProcessPiping,
  RECYCLE,
  RIG_Z,
  SYNTHESIS,
} from "@repo/design-system/components/contents/chemistry/haber/geometry";
import { evaluateHaberConverter } from "@repo/design-system/components/contents/chemistry/haber/model";
import {
  CondenserUnit,
  ConverterVessel,
} from "@repo/design-system/components/contents/chemistry/haber/vessels";
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
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";

const DROP_COUNT = 5;

function HaberCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 0.46, 1.56] : [0, 0.37, 1.18]}
      cameraTarget={[0, 0.24, 0.02]}
      fov={38}
      maxDistance={2.8}
      minDistance={0.45}
    />
  );
}

const FEED_TRACK = trackOf(FEED);
const SYNTHESIS_TRACK = trackOf(SYNTHESIS);
const RECYCLE_TRACK = trackOf(RECYCLE);
const FEED_START = pointOn(FEED_TRACK, 0.45);
const SYNTHESIS_START = pointOn(SYNTHESIS_TRACK, 0.5);
const RECYCLE_FIRST = pointOn(RECYCLE_TRACK, 0.28);
const RECYCLE_SECOND = pointOn(RECYCLE_TRACK, 0.76);

function FlowPulses({
  playing,
  relativeRate,
  yieldPercent,
}: {
  readonly playing: boolean;
  readonly relativeRate: number;
  readonly yieldPercent: number;
}) {
  const feedRef = useRef<Mesh>(null);
  const synthRef = useRef<Mesh>(null);
  const recycleARef = useRef<Mesh>(null);
  const recycleBRef = useRef<Mesh>(null);
  const dropRefs = useRef<(Mesh | null)[]>([]);
  const phaseRef = useRef(0.28);

  const dropAngles = useMemo(
    () => Arr.makeBy(DROP_COUNT, (index) => (index / DROP_COUNT) * Math.PI * 2),
    []
  );

  const speed = 0.28 + (relativeRate / 100) * 0.95;
  const liquidTop = 0.086 + (yieldPercent / 72) * 0.115;

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * speed;
    const p = phaseRef.current;

    if (feedRef.current !== null) {
      placeOn(FEED_TRACK, p % 1, feedRef.current.position);
      feedRef.current.position.z += 0.015;
    }
    if (synthRef.current !== null) {
      placeOn(SYNTHESIS_TRACK, (p + 0.35) % 1, synthRef.current.position);
      synthRef.current.position.z += 0.015;
    }
    if (recycleARef.current !== null) {
      placeOn(RECYCLE_TRACK, (p * 0.7) % 1, recycleARef.current.position);
      recycleARef.current.position.z += 0.016;
    }
    if (recycleBRef.current !== null) {
      placeOn(RECYCLE_TRACK, (p * 0.7 + 0.5) % 1, recycleBRef.current.position);
      recycleBRef.current.position.z += 0.016;
    }
    for (let i = 0; i < DROP_COUNT; i += 1) {
      const mesh = dropRefs.current[i];
      if (mesh !== null && mesh !== undefined) {
        const dropT = (p * 0.9 + i / DROP_COUNT) % 1;
        const y = 0.215 - dropT * Math.max(0.03, 0.215 - liquidTop);
        const ang = dropAngles[i] ?? 0;
        mesh.position.set(
          CONDENSER_X + Math.cos(ang) * 0.036,
          y,
          RIG_Z + Math.sin(ang) * 0.036
        );
      }
    }
  });

  return (
    <group>
      <mesh
        position={[FEED_START[0], FEED_START[1], FEED_START[2] + 0.015]}
        ref={feedRef}
      >
        <sphereGeometry args={[0.012, 12, 10]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.electronGold}
          emissive={PROCESS_COLORS.electronGold}
          emissiveIntensity={0.85}
        />
      </mesh>
      <mesh
        position={[
          SYNTHESIS_START[0],
          SYNTHESIS_START[1],
          SYNTHESIS_START[2] + 0.015,
        ]}
        ref={synthRef}
      >
        <sphereGeometry args={[0.012, 12, 10]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.vanadiumOrange}
          emissive={PROCESS_COLORS.vanadiumOrange}
          emissiveIntensity={0.85}
        />
      </mesh>
      <mesh
        position={[
          RECYCLE_FIRST[0],
          RECYCLE_FIRST[1],
          RECYCLE_FIRST[2] + 0.016,
        ]}
        ref={recycleARef}
      >
        <sphereGeometry args={[0.0115, 12, 10]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.catalystTeal}
          emissive={PROCESS_COLORS.catalystTeal}
          emissiveIntensity={0.9}
        />
      </mesh>
      <mesh
        position={[
          RECYCLE_SECOND[0],
          RECYCLE_SECOND[1],
          RECYCLE_SECOND[2] + 0.016,
        ]}
        ref={recycleBRef}
      >
        <sphereGeometry args={[0.0115, 12, 10]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.catalystTeal}
          emissive={PROCESS_COLORS.catalystTeal}
          emissiveIntensity={0.9}
        />
      </mesh>
      {/* Dripping cyan liquid ammonia condensation droplets */}
      {Arr.map(dropAngles, (ang, index) => {
        const dropT = (index / DROP_COUNT) % 1;
        const y = 0.215 - dropT * Math.max(0.03, 0.215 - liquidTop);
        return (
          <mesh
            key={ang}
            position={[
              CONDENSER_X + Math.cos(ang) * 0.036,
              y,
              RIG_Z + Math.sin(ang) * 0.036,
            ]}
            ref={(el) => {
              dropRefs.current[index] = el;
            }}
          >
            <sphereGeometry args={[0.0052, 10, 8]} />
            <meshPhysicalMaterial
              clearcoat={1}
              color={PROCESS_COLORS.ammoniaCyan}
              emissive={PROCESS_COLORS.ammoniaCyan}
              emissiveIntensity={0.35}
              roughness={0.12}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export function HaberConverterScene({
  parts,
  pressureAtm,
  temperatureC,
}: {
  readonly parts: Readonly<
    Record<
      | "compressor"
      | "coolingCondenser"
      | "ironCatalystBed"
      | "liquidAmmonia"
      | "recyclePipe",
      string
    >
  >;
  readonly pressureAtm: number;
  readonly temperatureC: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const labelInk = useLabelInk();
  const pistonRef = useRef<Group>(null);
  const flywheelRef = useRef<Group>(null);
  const crankRef = useRef(0);
  const reading = evaluateHaberConverter(temperatureC, pressureAtm);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    const dt = simulationStep(delta);
    const omega = 3.2 + (reading.relativeRate / 100) * 6.5;
    crankRef.current += dt * omega;
    if (pistonRef.current !== null) {
      pistonRef.current.position.y = 0.155 + Math.sin(crankRef.current) * 0.018;
    }
    if (flywheelRef.current !== null) {
      flywheelRef.current.rotation.x += dt * omega;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <HaberCamera />
      <PilotSkid />
      <CompressorUnit
        flywheelRef={flywheelRef}
        pistonRef={pistonRef}
        pressureAtm={pressureAtm}
      />
      <ConverterVessel temperatureC={temperatureC} />
      <CondenserUnit yieldPercent={reading.yieldPercent} />
      <ProcessPiping />
      <FlowPulses
        playing={playing}
        relativeRate={reading.relativeRate}
        yieldPercent={reading.yieldPercent}
      />
      {/* Well-separated adaptive labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[CONVERTER_X, 0.555, RIG_Z]}
      >
        <span>{parts.recyclePipe}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[CONDENSER_X, 0.485, RIG_Z + 0.05]}
      >
        <span>{parts.coolingCondenser}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[COMPRESSOR_X, 0.032, RIG_Z + 0.165]}
      >
        <span>{parts.compressor}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[CONVERTER_X, 0.032, RIG_Z + 0.165]}
      >
        <span>{parts.ironCatalystBed}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[CONDENSER_X, 0.032, RIG_Z + 0.165]}
      >
        <span>{parts.liquidAmmonia}</span>
      </ThreeLabel>
    </group>
  );
}
