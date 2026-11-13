import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  type Alert,
  alertOf,
  heatingWeeksOf,
  hotspotOf,
  palenessOf,
  REEF_MMM,
  WINDOW_WEEKS,
} from "@repo/design-system/components/contents/biology/climate/bleaching";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import {
  useQuantity,
  useReading,
} from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  useVisualScene,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import {
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Color } from "three";

/** Played, a week passes each second. */
const WEEKS_PER_SECOND = 1;

/** The tank: 60 cm long, 35 cm deep and 35 cm high, its water 30 cm deep. */
const TANK = { depth: 0.35, height: 0.35, length: 0.6, water: 0.3 } as const;

/**
 * A reef tank on a lab bench with corals from a reef whose warmest month
 * averages 29 °C. The reader sets the water's temperature with the heater and
 * how many weeks it stays there; the corals lose their algae and pale as the
 * heat stress, counted in Degree Heating Weeks as NOAA's Coral Reef Watch
 * counts it, builds up. The footer names the alert level.
 */
export function CoralBleachLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly alert: ReactNode;
    readonly alerts: Readonly<Record<Alert, ReactNode>>;
    readonly dhw: ReactNode;
    readonly hotspot: ReactNode;
    readonly temperature: string;
    readonly viewLabel: string;
    readonly weeks: string;
  };
  readonly title: ReactNode;
}) {
  const [temperature, setTemperature] = useState(29.5);
  const [weeks, setWeeks] = useState(4);
  const quantity = useQuantity();
  const reading = useReading();
  const hotspot = hotspotOf(temperature, REEF_MMM);
  const dhw = heatingWeeksOf(temperature, weeks, REEF_MMM);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <Labeled
          label={labels.temperature}
          shown={`${reading(temperature, 1)} °C`}
        >
          <Slider
            aria-label={labels.temperature}
            max={32}
            min={28}
            onValueChange={setTemperature}
            step={0.5}
            value={temperature}
          />
        </Labeled>
        <Labeled
          label={labels.weeks}
          shown={`${Math.round(weeks)}/${WINDOW_WEEKS}`}
        >
          <Slider
            aria-label={labels.weeks}
            max={WINDOW_WEEKS}
            min={0}
            onValueChange={setWeeks}
            step={1}
            value={weeks}
          />
        </Labeled>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.6} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.1, 0.36, 0.78]}
              cameraTarget={[0, 0.15, 0]}
              fov={34}
              maxDistance={1.6}
              minDistance={0.35}
            />
            <TankScene
              onWeeks={setWeeks}
              paleness={palenessOf(dhw)}
              temperature={temperature}
              weeks={weeks}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.hotspot}
            value={
              <InlineMath math={quantity(hotspot, "\\,^\\circ\\text{C}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.dhw}
            value={<InlineMath math={quantity(dhw, "", 1)} />}
          />
          <VisualFactTabular
            label={labels.alert}
            value={labels.alerts[alertOf(hotspot, dhw)]}
          />
          <VisualFactTabular
            label={labels.weeks}
            value={<InlineMath math={quantity(weeks, "", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** A slider with its name and its value above it. */
function Labeled({
  children,
  label,
  shown,
}: {
  readonly children: ReactNode;
  readonly label: string;
  readonly shown: string;
}) {
  return (
    <div className="flex min-w-44 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span>{label}</span>
        <span className="tabular-nums">{shown}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * The bench, the glass tank with its water and sand, the corals and the
 * heater with its display. Played, the weeks run on and reach the card.
 */
function TankScene({
  onWeeks,
  paleness,
  temperature,
  weeks,
}: {
  readonly onWeeks: (weeks: number) => void;
  readonly paleness: number;
  readonly temperature: number;
  readonly weeks: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const clock = useRef(weeks);
  const sent = useRef(weeks);
  const reading = useReading();
  const tissue = useMemo(
    () =>
      new Color(MATERIAL.coralHealthy).lerp(
        new Color(MATERIAL.coralBleached),
        paleness
      ),
    [paleness]
  );
  const tips = useMemo(
    () =>
      new Color(MATERIAL.coralTip).lerp(
        new Color(MATERIAL.coralBleached),
        paleness
      ),
    [paleness]
  );

  useEffect(() => {
    if (weeks !== sent.current) {
      clock.current = weeks;
      sent.current = weeks;
    }
  }, [weeks]);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current += Math.min(delta, 0.1) * WEEKS_PER_SECOND;
    if (clock.current > WINDOW_WEEKS + 1) {
      clock.current = 0;
    }
    const whole = Math.min(WINDOW_WEEKS, Math.floor(clock.current));
    if (whole !== sent.current) {
      sent.current = whole;
      onWeeks(whole);
    }
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <LabBench />
      <group position={[0, 0, 0]}>
        <TankGlass />
        <mesh position={[0, TANK.water / 2 + 0.004, -0.004]}>
          <boxGeometry
            args={[TANK.length - 0.01, TANK.water, TANK.depth - 0.018]}
          />
          <LiquidMaterial color={MATERIAL.solution} opacity={0.12} />
        </mesh>
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry
            args={[TANK.length - 0.012, 0.035, TANK.depth - 0.012]}
          />
          <meshStandardMaterial color={MATERIAL.sand} roughness={1} />
        </mesh>
        <BranchingCoral
          color={tissue}
          position={[-0.13, 0.035, -0.04]}
          seed={1}
          tips={tips}
        />
        <BranchingCoral
          color={tissue}
          position={[0.15, 0.035, 0.05]}
          seed={2}
          tips={tips}
        />
        <mesh castShadow position={[0.02, 0.07, -0.06]} scale={[1, 0.7, 1]}>
          <sphereGeometry args={[0.06, 40, 24]} />
          <meshStandardMaterial color={tissue} roughness={0.85} />
        </mesh>
        <mesh
          castShadow
          position={[-0.02, 0.06, 0.09]}
          rotation={[0.1, 0, 0.12]}
        >
          <cylinderGeometry args={[0.07, 0.02, 0.012, 32]} />
          <meshStandardMaterial color={tissue} roughness={0.8} />
        </mesh>
        <group
          position={[TANK.length / 2 - 0.04, 0.16, -TANK.depth / 2 + 0.03]}
        >
          <mesh castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.2, 16]} />
            <MetalMaterial color={MATERIAL.probeSteel} roughness={0.3} />
          </mesh>
        </group>
        <group position={[TANK.length / 2 + 0.07, 0.05, 0.05]}>
          <RoundedBox
            args={[0.08, 0.1, 0.03]}
            castShadow
            position={[0, 0, 0]}
            radius={0.008}
          >
            <meshStandardMaterial color={MATERIAL.meterBody} roughness={0.5} />
          </RoundedBox>
          <ThreeLabel
            color={MATERIAL.meterInk}
            fontSize="compact"
            outlineColor={MATERIAL.meterHalo}
            outlineWidth={0.003}
            position={[0, 0.015, 0.017]}
          >
            <span className="font-mono tabular-nums">
              {reading(temperature, 1)} °C
            </span>
          </ThreeLabel>
        </group>
      </group>
    </>
  );
}

/**
 * The tank's glass: a back pane, two side panes and the floor, with only a
 * rim along the open front, so the reader looks straight in at the corals.
 */
function TankGlass() {
  const panes = [
    [
      "back",
      [0, TANK.height / 2, -TANK.depth / 2],
      [TANK.length, TANK.height, 0.006],
    ],
    [
      "left",
      [-TANK.length / 2, TANK.height / 2, 0],
      [0.006, TANK.height, TANK.depth],
    ],
    [
      "right",
      [TANK.length / 2, TANK.height / 2, 0],
      [0.006, TANK.height, TANK.depth],
    ],
    ["rim", [0, TANK.height, TANK.depth / 2], [TANK.length, 0.008, 0.008]],
    ["sill", [0, 0.004, TANK.depth / 2], [TANK.length, 0.008, 0.008]],
  ] as const;
  return (
    <group>
      {Arr.map(panes, ([name, position, size]) => (
        <mesh castShadow key={name} position={position}>
          <boxGeometry args={size} />
          <GlassMaterial color={MATERIAL.glass} opacity={0.14} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A branching coral colony like Acropora: a short base, then branches that
 * fork twice, each tipped with a paler growing tip.
 */
function BranchingCoral({
  color,
  position,
  seed,
  tips,
}: {
  readonly color: Color;
  readonly position: readonly [number, number, number];
  readonly seed: number;
  readonly tips: Color;
}) {
  const branches = useMemo(() => branchesOf(seed), [seed]);
  return (
    <group position={position}>
      {Arr.map(branches, ([id, x, y, z, tiltX, tiltZ, length, radius]) => (
        <group key={id} position={[x, y, z]} rotation={[tiltX, 0, tiltZ]}>
          <mesh castShadow position={[0, length / 2, 0]}>
            <cylinderGeometry args={[radius * 0.8, radius, length, 10]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
          <mesh castShadow position={[0, length, 0]}>
            <sphereGeometry args={[radius * 0.85, 10, 8]} />
            <meshStandardMaterial color={tips} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * The branches of colony `seed`: each as its number, its base point, its two tilts, its
 * length and its radius, in metres. Twelve branches fan up from the base at
 * seeded angles and heights.
 */
function branchesOf(seed: number) {
  return Arr.map(Arr.range(0, 13), (branch) => {
    const angle = hashUnit(seed, branch) * Math.PI * 2;
    const lean = 0.2 + hashUnit(seed + 7, branch) * 0.6;
    const height = hashUnit(seed + 3, branch) * 0.03;
    return [
      branch,
      Math.cos(angle) * 0.015,
      height,
      Math.sin(angle) * 0.015,
      Math.sin(angle) * lean,
      -Math.cos(angle) * lean,
      0.06 + hashUnit(seed + 5, branch) * 0.06,
      0.007,
    ] as const;
  });
}
