import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  AXIS_X,
  AXIS_Z,
  esterTint,
} from "@repo/design-system/components/contents/chemistry/ester/geometry";
import type { EsterId } from "@repo/design-system/components/contents/chemistry/ester/model";
import { evaluateEsterReflux } from "@repo/design-system/components/contents/chemistry/ester/model";
import {
  LiebigCondenser,
  RefluxHotplate,
  RetortStand,
  RoundBottomFlask,
  WaterBathDish,
} from "@repo/design-system/components/contents/chemistry/ester/parts";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

const BATH_BUBBLES = Arr.makeBy(12, (index) => ({
  angle: index * 2.39,
  id: `bath-b-${index}`,
  offset: (index * 0.19) % 1,
  r: 0.036 + (index % 3) * 0.006,
  size: 0.0018 + (index % 2) * 0.0007,
}));

const VAPOUR_WISPS = Arr.makeBy(5, (index) => ({
  angle: index * 1.4,
  id: `vapour-${index}`,
  offset: index / 5,
}));

const REFLUX_DROPS = Arr.makeBy(4, (index) => ({
  angle: index * 1.6 + 0.5,
  id: `drop-${index}`,
  offset: index / 4,
}));

const CATALYST_DROPS = Arr.makeBy(6, (index) => ({
  angle: (index / 6) * Math.PI * 2 + 0.3,
  id: `cat-${index}`,
  r: 0.014 + (index % 2) * 0.011,
}));

function stepBathBubbles(group: Group | null, t: number) {
  if (group === null) {
    return;
  }
  for (let i = 0; i < group.children.length; i += 1) {
    const child = group.children[i];
    const b = BATH_BUBBLES[i];
    if (child !== undefined && b !== undefined) {
      const p = (t * 0.55 + b.offset) % 1;
      child.position.set(
        AXIS_X + Math.cos(b.angle) * b.r,
        0.064 + p * 0.048,
        AXIS_Z + Math.sin(b.angle) * b.r
      );
    }
  }
}

function stepVapour(group: Group | null, t: number, reach: number) {
  if (group === null) {
    return;
  }
  for (let i = 0; i < group.children.length; i += 1) {
    const child = group.children[i];
    const w = VAPOUR_WISPS[i];
    if (child !== undefined && w !== undefined) {
      const p = (t * 0.65 + w.offset) % 1;
      const sway = Math.sin(t * 4 + w.angle) * 0.0018;
      child.position.set(AXIS_X + sway, 0.165 + p * reach, AXIS_Z - sway);
    }
  }
}

function stepRefluxDrops(group: Group | null, t: number, reach: number) {
  if (group === null) {
    return;
  }
  const yStart = 0.175 + reach * 0.92;
  for (let i = 0; i < group.children.length; i += 1) {
    const child = group.children[i];
    const d = REFLUX_DROPS[i];
    if (child !== undefined && d !== undefined) {
      const p = (t * 0.72 + d.offset) % 1;
      child.position.set(
        AXIS_X + Math.cos(d.angle) * 0.0038,
        yStart - p * (yStart - 0.145),
        AXIS_Z + Math.sin(d.angle) * 0.0038
      );
    }
  }
}

function stepCatalystDrops(group: Group | null, t: number, interfaceY: number) {
  if (group === null) {
    return;
  }
  for (let i = 0; i < group.children.length; i += 1) {
    const child = group.children[i];
    const c = CATALYST_DROPS[i];
    if (child !== undefined && c !== undefined) {
      const bob = Math.sin(t * 3 + c.angle) * 0.002;
      child.position.set(
        AXIS_X + Math.cos(c.angle) * c.r,
        interfaceY - 0.003 + bob,
        AXIS_Z + Math.sin(c.angle) * c.r
      );
    }
  }
}

function EsterCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.06, 0.34, 1.08] : [0.08, 0.29, 0.88]}
      cameraTarget={[0.01, 0.235, 0.02]}
      fov={38}
      maxDistance={1.9}
      minDistance={0.35}
    />
  );
}

export function EsterificationRefluxScene({
  ester,
  parts,
  temperatureC,
}: {
  readonly ester: EsterId;
  readonly parts: Readonly<
    Record<
      "catalystDrop" | "condenser" | "esterLayer" | "roundFlask" | "waterBath",
      string
    >
  >;
  readonly temperatureC: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const labelInk = useLabelInk();
  const bathBubblesRef = useRef<Group>(null);
  const vapourRef = useRef<Group>(null);
  const refluxDropsRef = useRef<Group>(null);
  const catalystRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const reading = evaluateEsterReflux(ester, temperatureC);
  const heatNorm = Math.min(1, Math.max(0, (temperatureC - 30) / 70));
  const organicColor = esterTint(ester);

  const esterThickness = 0.005 + reading.esterLayerRatio * 0.017;
  const interfaceY = 0.128 - esterThickness * 0.25;
  const vapourReach = useMemo(
    () => (reading.refluxing ? 0.22 : 0.09 + heatNorm * 0.08),
    [heatNorm, reading.refluxing]
  );

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    const step = simulationStep(delta);
    phaseRef.current += step * (0.45 + heatNorm * 1.45);
    const t = phaseRef.current;

    stepBathBubbles(bathBubblesRef.current, t);
    stepVapour(vapourRef.current, t, vapourReach);
    stepRefluxDrops(refluxDropsRef.current, t, vapourReach);
    stepCatalystDrops(catalystRef.current, t, interfaceY);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <EsterCamera />
      <LabBench width={2.6} />

      <RetortStand />
      <RefluxHotplate heatNorm={heatNorm} playing={playing} />
      <WaterBathDish />
      <RoundBottomFlask
        ester={ester}
        esterLayerRatio={reading.esterLayerRatio}
      />
      <LiebigCondenser />

      {/* Thermal convection micro-bubbles inside the warm water bath */}
      <group ref={bathBubblesRef}>
        {Arr.map(BATH_BUBBLES, (b) => (
          <mesh
            key={b.id}
            position={[
              AXIS_X + Math.cos(b.angle) * b.r,
              0.064 + b.offset * 0.048,
              AXIS_Z + Math.sin(b.angle) * b.r,
            ]}
            renderOrder={2}
          >
            <sphereGeometry args={[b.size, 8, 8]} />
            <meshPhysicalMaterial
              clearcoat={1}
              color={BENCH_COLORS.schellbachWhite}
              depthWrite={false}
              opacity={0.55 + heatNorm * 0.3}
              roughness={0.1}
              transparent
            />
          </mesh>
        ))}
      </group>

      {/* Amber-gold H2SO4 acid catalyst droplets near the liquid interface */}
      <group ref={catalystRef}>
        {Arr.map(CATALYST_DROPS, (c) => (
          <mesh
            key={c.id}
            position={[
              AXIS_X + Math.cos(c.angle) * c.r,
              interfaceY - 0.003,
              AXIS_Z + Math.sin(c.angle) * c.r,
            ]}
            renderOrder={1}
          >
            <sphereGeometry args={[0.0034, 10, 10]} />
            <meshPhysicalMaterial
              clearcoat={0.8}
              color={ORGANIC_COLORS.doubleBondGold}
              roughness={0.2}
            />
          </mesh>
        ))}
      </group>

      {/* Rising ester vapour wisps inside inner condenser tube */}
      <group ref={vapourRef}>
        {Arr.map(VAPOUR_WISPS, (w) => (
          <mesh
            key={w.id}
            position={[AXIS_X, 0.165 + w.offset * vapourReach, AXIS_Z]}
            renderOrder={1}
          >
            <sphereGeometry args={[0.0046, 10, 10]} />
            <meshStandardMaterial
              color={organicColor}
              depthWrite={false}
              emissive={organicColor}
              emissiveIntensity={0.25}
              opacity={0.34 + heatNorm * 0.2}
              roughness={0.6}
              transparent
            />
          </mesh>
        ))}
      </group>

      {/* Condensing ester reflux droplets dripping down into flask */}
      <group ref={refluxDropsRef}>
        {Arr.map(REFLUX_DROPS, (d) => (
          <mesh
            key={d.id}
            position={[
              AXIS_X + Math.cos(d.angle) * 0.0038,
              0.175 + vapourReach * (1 - d.offset) * 0.85,
              AXIS_Z + Math.sin(d.angle) * 0.0038,
            ]}
            renderOrder={1}
          >
            <sphereGeometry args={[0.0028, 10, 10]} />
            <meshPhysicalMaterial
              clearcoat={0.9}
              color={organicColor}
              roughness={0.14}
            />
          </mesh>
        ))}
      </group>

      {/* Crisp adaptive-ink labels */}
      <ThreeLabel
        anchorX="left"
        color={labelInk}
        fontSize="compact"
        position={[AXIS_X + 0.072, 0.358, AXIS_Z]}
      >
        <span>{parts.condenser}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={labelInk}
        fontSize="compact"
        position={[AXIS_X - 0.072, 0.162, AXIS_Z + 0.02]}
      >
        <span>{parts.roundFlask}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={labelInk}
        fontSize="compact"
        position={[AXIS_X + 0.068, 0.155, AXIS_Z + 0.015]}
      >
        <span>{parts.esterLayer}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={labelInk}
        fontSize="compact"
        position={[AXIS_X - 0.088, 0.084, AXIS_Z + 0.02]}
      >
        <span>{parts.waterBath}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={labelInk}
        fontSize="compact"
        position={[AXIS_X + 0.072, 0.095, AXIS_Z + 0.025]}
      >
        <span>{parts.catalystDrop}</span>
      </ThreeLabel>
    </group>
  );
}
