import { useFrame, useThree } from "@react-three/fiber";
import {
  CARBON_HALF_LIFE,
  decayTimes,
  expectedSurvivors,
  scatterSites,
  survivors,
} from "@repo/design-system/components/contents/chemistry/decay/law";
import { HandSlider } from "@repo/design-system/components/contents/chemistry/slider";
import {
  MATH_NUMBER_OPTIONS,
  mathNumber,
} from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import {
  type ReactNode,
  Suspense,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Color, type InstancedMesh, Object3D } from "three";
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
  readonly description: ReactNode;
  readonly labels: DecayLabels;
  readonly title: ReactNode;
}) {
  const format = useFormatter();
  const [years, setYears] = useState(CARBON_HALF_LIFE);
  const times = useMemo(() => decayTimes(SIDE * SIDE, CARBON_HALF_LIFE), []);
  const number = (value: number, digits: number) =>
    mathNumber(
      format.number(value, {
        ...MATH_NUMBER_OPTIONS,
        maximumFractionDigits: digits,
      })
    );
  const count = SIDE * SIDE;

  return (
    <VisualCard>
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
          <Suspense>
            <DecayCamera />
            <DecaySample onTime={setYears} times={times} years={years} />
          </Suspense>
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

/**
 * The nuclei on a square sample: carbon-14 dark, nitrogen-14 violet. While
 * the card plays, time runs and reports back to the card a few times a second.
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
  const clock = useRef(years);
  const reported = useRef(years);
  const carbon = useMemo(() => new Color(getColor("NEUTRAL", 800)), []);
  const nitrogen = useMemo(() => new Color(PLOT_COLORS.violet), []);

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
        0.2,
        (Math.floor(site / SIDE) - (SIDE - 1) / 2) * 0.5
      );
      place.scale.setScalar(0.19);
      place.updateMatrix();
      instances.setMatrixAt(index, place.matrix);
    }
    instances.instanceMatrix.needsUpdate = true;
  }, [times]);

  useFrame((_, seconds) => {
    const instances = mesh.current;
    if (instances === null) {
      return;
    }
    if (playing) {
      clock.current =
        (clock.current + seconds * PACE * CARBON_HALF_LIFE) %
        (HALF_LIVES * CARBON_HALF_LIFE);
      if (Math.abs(clock.current - reported.current) > CARBON_HALF_LIFE / 8) {
        reported.current = clock.current;
        onTime(Math.round(clock.current / 10) * 10);
      }
    } else {
      clock.current = years;
    }
    for (const [index, decay] of Arr.map(
      times,
      (time, at) => [at, time] as const
    )) {
      instances.setColorAt(index, decay > clock.current ? carbon : nitrogen);
    }
    if (instances.instanceColor !== null) {
      instances.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[SIDE * 0.5 + 0.4, 0.04, SIDE * 0.5 + 0.4]} />
        <meshStandardMaterial color={getColor("STONE", 600)} roughness={0.8} />
      </mesh>
      <instancedMesh args={[undefined, undefined, times.length]} ref={mesh}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshPhysicalMaterial clearcoat={0.6} roughness={0.35} />
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
