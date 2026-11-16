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
import { BrainCoral } from "@repo/design-system/components/contents/biology/climate/brain";
import { Paleness } from "@repo/design-system/components/contents/biology/climate/coral";
import { Heater } from "@repo/design-system/components/contents/biology/climate/heater";
import { PlateCoral } from "@repo/design-system/components/contents/biology/climate/plate";
import {
  SandBed,
  sandLevel,
} from "@repo/design-system/components/contents/biology/climate/sand";
import { StaghornCoral } from "@repo/design-system/components/contents/biology/climate/staghorn";
import {
  ReefLight,
  TankGlass,
  WaterSurface,
} from "@repo/design-system/components/contents/biology/climate/tank";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  useQuantity,
  useReading,
} from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
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
import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";

/** Played, a week passes each second. */
const WEEKS_PER_SECOND = 1;

/**
 * Where the corals stand on the sand, in metres: two staghorn colonies on
 * their rocks, each with the reach its branches may spread to, a brain coral
 * at the back and a plate coral lying free at the front.
 */
const LEFT = { reach: 0.1, x: -0.155, z: -0.045 };
const RIGHT = { reach: 0.095, x: 0.145, z: 0.015 };
const BRAIN = { radius: 0.064, x: 0.02, z: -0.075 };
const PLATE = { radius: 0.058, x: -0.035, z: 0.085 };

/** Where the heater's foot stands, 2.5 cm above the sand at the back. */
const HEATER_BASE = sandLevel(-0.15) + 0.025;

/** The sand kept flat under each coral and the heater, `[x, z, radius]`. */
const CLEARINGS = [
  [LEFT.x, LEFT.z, 0.045],
  [RIGHT.x, RIGHT.z, 0.045],
  [BRAIN.x, BRAIN.z, BRAIN.radius * 1.04],
  [PLATE.x, PLATE.z, PLATE.radius * 1.14],
  [0.255, -0.15, 0.016],
] as const;

/**
 * The brain and plate corals as spheres `[x, y, z, radius]` round them, in
 * the frame of a staghorn colony at `(x, z)`, so its branches keep clear.
 */
function obstaclesFor(x: number, z: number) {
  const floor = sandLevel(z);
  return [
    [BRAIN.x - x, sandLevel(BRAIN.z) - floor, BRAIN.z - z, BRAIN.radius * 1.08],
    [
      PLATE.x - x,
      sandLevel(PLATE.z) + 0.008 - floor,
      PLATE.z - z,
      PLATE.radius * 1.2,
    ],
  ] as const;
}
const LEFT_OBSTACLES = obstaclesFor(LEFT.x, LEFT.z);
const RIGHT_OBSTACLES = obstaclesFor(RIGHT.x, RIGHT.z);

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
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly alert: ReactNode;
    readonly alerts: Readonly<Record<Alert, ReactNode>>;
    readonly dhw: ReactNode;
    readonly hotspot: ReactNode;
    readonly temperature: string;
    readonly viewLabel: string;
    readonly weeks: string;
  };
  readonly title: NonNullable<ReactNode>;
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
 * The bench and the reef tank: its glass, water, light and sand, the corals
 * paling together as the bleaching model says, and the heater with its
 * controller. Played, the weeks run on and reach the card.
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
      <TankGlass />
      <WaterSurface />
      <ReefLight />
      <SandBed clearings={CLEARINGS} />
      <Paleness value={paleness}>
        <StaghornCoral
          colony="brown"
          obstacles={LEFT_OBSTACLES}
          position={[LEFT.x, sandLevel(LEFT.z), LEFT.z]}
          reach={LEFT.reach}
          seed={3}
        />
        <StaghornCoral
          colony="gold"
          obstacles={RIGHT_OBSTACLES}
          position={[RIGHT.x, sandLevel(RIGHT.z), RIGHT.z]}
          reach={RIGHT.reach}
          seed={8}
        />
        <BrainCoral
          colony="olive"
          position={[BRAIN.x, sandLevel(BRAIN.z) + 0.0015, BRAIN.z]}
          radius={BRAIN.radius}
          seed={5}
        />
        <PlateCoral
          colony="brown"
          position={[PLATE.x, sandLevel(PLATE.z) - 0.0006, PLATE.z]}
          radius={PLATE.radius}
          seed={2}
          turn={0.5}
        />
      </Paleness>
      <Heater base={HEATER_BASE} temperature={temperature} />
    </>
  );
}
