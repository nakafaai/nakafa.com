import { useFrame, useThree } from "@react-three/fiber";
import {
  CARBON_HALF_LIFE,
  decayTimes,
  expectedSurvivors,
  scatterSites,
  survivors,
} from "@repo/design-system/components/contents/chemistry/decay/law";
import { HandSlider } from "@repo/design-system/components/contents/chemistry/slider";
import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";
import { useCycleClock } from "@repo/design-system/components/contents/simulation/clock";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  useVisualScene,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { InstancedMesh } from "three";
import { Color, Object3D } from "three";
import { useFormatter } from "use-intl";

/** How many nuclei stand on each side of the square sample. */
const SIDE = 20;

/** How many half-lives the slider spans. */
const HALF_LIVES = 5;

/** How many half-lives pass in one second while the card plays. */
const PACE = 0.5;

/** The words a decay lab reads from its lesson. */
interface DecayLabels {
  /** The readout of the nuclei counted on the sample. */
  readonly counted: ReactNode;
  /** The readout of the nuclei the decay law expects. */
  readonly expected: ReactNode;
  /** The readout of how many half-lives have passed. */
  readonly halfLives: ReactNode;
  /** The name of the time slider and its readout. */
  readonly time: string;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
  /** The word for years, written inside the readouts. */
  readonly years: string;
}

/**
 * A sample of 400 carbon-14 nuclei, each turning into nitrogen-14 at its own
 * moment, so no one can say when a single nucleus decays, yet the count halves
 * every 5730 years. The slider runs time over five half-lives; the footer sets
 * the nuclei counted on the sample beside the number the decay law expects.
 */
export function RadioactiveDecayLab({
  description,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: DecayLabels;
  readonly title: NonNullable<ReactNode>;
}) {
  const format = useFormatter();
  const [years, setYears] = useState(CARBON_HALF_LIFE);
  const times = useMemo(() => decayTimes(SIDE * SIDE, CARBON_HALF_LIFE), []);
  const number = (value: number, digits: number) =>
    mathNumber(format.number(value, "math", { maximumFractionDigits: digits }));
  const count = SIDE * SIDE;

  return (
    <VisualCard onReset={() => setYears(CARBON_HALF_LIFE)}>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.time}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath
                math={`${number(years, 0)}\\ \\text{${labels.years}}`}
              />
            </span>
          </div>
          <HandSlider
            label={labels.time}
            max={HALF_LIVES * CARBON_HALF_LIFE}
            onChange={setYears}
            step={10}
            value={years}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={7} setting="studio">
          <DecayCamera />
          <DecaySample onTime={setYears} times={times} years={years} />
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.time}
            value={
              <InlineMath
                math={`t = ${number(years, 0)}\\ \\text{${labels.years}}`}
              />
            }
          />
          <VisualFact
            label={labels.halfLives}
            value={
              <InlineMath
                math={`\\dfrac{t}{T_{1/2}} = \\dfrac{${number(years, 0)}}{${number(CARBON_HALF_LIFE, 0)}} = ${number(years / CARBON_HALF_LIFE, 2)}`}
              />
            }
          />
          <VisualFact
            label={labels.counted}
            value={<InlineMath math={`N = ${survivors(times, years)}`} />}
          />
          <VisualFact
            label={labels.expected}
            value={
              <InlineMath
                math={`N_0 \\left(\\tfrac{1}{2}\\right)^{t/T_{1/2}} = ${number(expectedSurvivors(count, years, CARBON_HALF_LIFE), 1)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

const TRAY_SPAN = SIDE * 0.5 + 0.6;
const CORNER_BOLTS = [
  [-TRAY_SPAN / 2 + 0.22, -TRAY_SPAN / 2 + 0.22],
  [TRAY_SPAN / 2 - 0.22, -TRAY_SPAN / 2 + 0.22],
  [-TRAY_SPAN / 2 + 0.22, TRAY_SPAN / 2 - 0.22],
  [TRAY_SPAN / 2 - 0.22, TRAY_SPAN / 2 - 0.22],
] as const;

/**
 * The nuclei on a machined radiometric aluminium specimen tray with a side
 * Geiger-Muller detector probe: carbon-14 dark graphite, nitrogen-14 violet,
 * and a brief golden beta-emission flash at the moment of decay.
 */
function DecaySample({
  onTime,
  times,
  years,
}: {
  readonly onTime: (years: number) => void;
  readonly times: readonly number[];
  readonly years: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const mesh = useRef<InstancedMesh>(null);
  const totalYears = HALF_LIVES * CARBON_HALF_LIFE;
  const clock = useCycleClock({
    initial: CARBON_HALF_LIFE,
    onValue: onTime,
    rate: PACE * CARBON_HALF_LIFE,
    steps: totalYears / 10,
    total: totalYears,
    value: years,
  });
  const carbon = useMemo(() => new Color(getColor("NEUTRAL", 800)), []);
  const nitrogen = useMemo(() => new Color(PLOT_COLORS.violet), []);
  const flash = useMemo(() => new Color(INSTRUMENT_COLORS.tapeYellow), []);
  const activity = 0.5 ** (years / CARBON_HALF_LIFE);

  useLayoutEffect(() => {
    const instances = mesh.current;
    if (instances === null) {
      return;
    }
    const place = new Object3D();
    const sites = scatterSites(times.length);
    for (const [index, site] of Arr.map(
      sites,
      (each, at) => [at, each] as const
    )) {
      place.position.set(
        ((site % SIDE) - (SIDE - 1) / 2) * 0.5,
        0.24,
        (Math.floor(site / SIDE) - (SIDE - 1) / 2) * 0.5
      );
      place.scale.setScalar(0.19);
      place.updateMatrix();
      instances.setMatrixAt(index, place.matrix);
    }
    instances.instanceMatrix.needsUpdate = true;
  }, [times]);

  useFrame(() => {
    const instances = mesh.current;
    if (instances === null) {
      return;
    }
    const now = clock.current;
    for (const [index, decay] of Arr.map(
      times,
      (time, at) => [at, time] as const
    )) {
      const recentBeta = playing && decay <= now && now - decay < 140;
      let tone = nitrogen;
      if (recentBeta) {
        tone = flash;
      } else if (decay > now) {
        tone = carbon;
      }
      instances.setColorAt(index, tone);
    }
    if (instances.instanceColor !== null) {
      instances.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      {/* Machined dark anodised radiometric specimen tray with brass border & corner screws */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[TRAY_SPAN + 0.55, 0.08, TRAY_SPAN + 0.55]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.52} />
      </mesh>
      <mesh position={[0, 0.085, 0]} receiveShadow>
        <boxGeometry args={[TRAY_SPAN, 0.03, TRAY_SPAN]} />
        <meshPhysicalMaterial
          clearcoat={0.25}
          color={BENCH_COLORS.epoxy}
          roughness={0.58}
        />
      </mesh>
      {Arr.map(CORNER_BOLTS, ([bx, bz]) => (
        <mesh castShadow key={`bolt-${bx}-${bz}`} position={[bx, 0.108, bz]}>
          <cylinderGeometry args={[0.14, 0.14, 0.06, 6]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
        </mesh>
      ))}
      {/* Side-mounted Geiger-Muller detector probe with activity LED */}
      <group
        position={[TRAY_SPAN / 2 + 0.95, 0.55, -0.6]}
        rotation={[0, 0, 0.28]}
      >
        <mesh castShadow>
          <cylinderGeometry args={[0.28, 0.3, 2.2, 24]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.32} />
        </mesh>
        <mesh position={[0, -1.18, 0]}>
          <cylinderGeometry args={[0.32, 0.24, 0.24, 24]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0.82, 0.28]}>
          <sphereGeometry args={[0.1, 14, 12]} />
          <meshStandardMaterial
            color={INSTRUMENT_COLORS.statusLed}
            emissive={INSTRUMENT_COLORS.statusLed}
            emissiveIntensity={0.25 + activity * 1.4}
          />
        </mesh>
      </group>
      <instancedMesh
        args={[undefined, undefined, times.length]}
        castShadow
        ref={mesh}
      >
        <sphereGeometry args={[1, 16, 12]} />
        <meshPhysicalMaterial
          clearcoat={0.68}
          clearcoatRoughness={0.14}
          roughness={0.3}
        />
      </instancedMesh>
    </group>
  );
}

/** Looks down on the sample at an angle, farther back on a narrow card. */
function DecayCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 17 : 13;
  return (
    <CameraControls
      cameraPosition={[0, distance * 0.75, distance * 0.66]}
      cameraTarget={[0, 0, 0.3]}
      fov={40}
      maxDistance={distance * 1.8}
      minDistance={3}
    />
  );
}
