import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  alphaPath,
  alphaSpeed,
  closestApproach,
  cumulativeLengths,
  GOLD_CHARGE,
  GOLD_NUCLEUS,
  pointAlong,
} from "@repo/design-system/components/contents/chemistry/scattering/coulomb";
import {
  MATH_NUMBER_OPTIONS,
  mathNumber,
} from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
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
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option } from "effect";
import { constant } from "effect/Function";
import { createRef, type ReactNode, Suspense, useMemo, useState } from "react";
import { Color, type Mesh } from "three";
import { useFormatter } from "use-intl";

/** How many femtometres one scene unit spans. */
const FEMTOMETRES = 10;

/** How far from the nucleus the paths are drawn, in femtometres. */
const LIMIT = 180;

/** The widest miss distance drawn, in femtometres. */
const WIDEST = 150;

/** How many paths pass on each side of the nucleus. */
const PATHS_PER_SIDE = 7;

/** The radius of a gold atom in femtometres, 144 pm, which the nucleus sits inside. */
const GOLD_ATOM = 144_000;

/** The kinetic energies the slider offers, in MeV: radium and polonium alphas fall inside. */
const ENERGY = { max: 9, min: 2, start: 5, step: 0.1 } as const;

/** How fast an alpha crosses the view far from the nucleus, in femtometres a second. */
const SPEED = 90;

/**
 * The miss distances of the paths: one straight at the nucleus and the rest
 * on both sides, crowded near the nucleus where the turning happens.
 */
const IMPACTS = Arr.flatMap(Arr.range(0, PATHS_PER_SIDE), (step) => {
  const impact = WIDEST * (step / PATHS_PER_SIDE) ** 1.7;
  return step === 0 ? [0] : [impact, -impact];
});

/** The words a scattering lab reads from its lesson. */
interface ScatteringLabels {
  /** The readout of the closest a head-on alpha comes. */
  readonly approach: ReactNode;
  /** The name of the energy slider and its readout. */
  readonly energy: string;
  /** The readout of the radius of the gold nucleus. */
  readonly nucleus: ReactNode;
  /** The readout of how many times wider the atom is than its nucleus. */
  readonly ratio: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * Rutherford's gold foil, seen at the scale of one nucleus: alpha particles
 * fly in from the left at evenly spread miss distances and follow the exact
 * hyperbolas the Coulomb push gives them. Far misses fly on almost straight,
 * near ones turn, and the one aimed straight at the nucleus comes right back.
 * A faster alpha comes closer before it turns. The footer reads the energy,
 * the closest approach, the nucleus' radius, and how much larger the atom is.
 */
export function RutherfordScatteringLab({
  description,
  energy: start = ENERGY.start,
  labels,
  title,
}: {
  readonly description: ReactNode;
  /** The alpha energy the slider starts at, in MeV: 5.3 for polonium, 7.7 for radium C. */
  readonly energy?: number;
  readonly labels: ScatteringLabels;
  readonly title: ReactNode;
}) {
  const format = useFormatter();
  const [energy, setEnergy] = useState<number>(
    Math.min(ENERGY.max, Math.max(ENERGY.min, start))
  );
  const approach = closestApproach(energy, GOLD_CHARGE);
  const number = (value: number, digits: number) =>
    mathNumber(
      format.number(value, {
        ...MATH_NUMBER_OPTIONS,
        maximumFractionDigits: digits,
      })
    );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.energy}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={`${number(energy, 1)}\\ \\mathrm{MeV}`} />
            </span>
          </div>
          <Slider
            aria-label={labels.energy}
            max={ENERGY.max}
            min={ENERGY.min}
            onValueChange={(value: number) => setEnergy(value)}
            step={ENERGY.step}
            value={energy}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={LIMIT / FEMTOMETRES} setting="space">
          <Suspense>
            <ScatteringCamera />
            <ScatteringScene approach={approach} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.energy}
            value={
              <InlineMath math={`E = ${number(energy, 1)}\\ \\mathrm{MeV}`} />
            }
          />
          <VisualFact
            label={labels.approach}
            value={
              <InlineMath math={`d = ${number(approach, 1)}\\ \\mathrm{fm}`} />
            }
          />
          <VisualFact
            label={labels.nucleus}
            value={
              <InlineMath
                math={`R \\approx ${number(GOLD_NUCLEUS, 0)}\\ \\mathrm{fm}`}
              />
            }
          />
          <VisualFact
            label={labels.ratio}
            value={
              <InlineMath
                math={`\\dfrac{${number(GOLD_ATOM, 0)}\\ \\mathrm{fm}}{${number(GOLD_NUCLEUS, 0)}\\ \\mathrm{fm}} \\approx ${number(Math.round(GOLD_ATOM / GOLD_NUCLEUS / 1000) * 1000, 0)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The nucleus, the circle no alpha of this energy can enter, every path, and
 * one alpha on each path. While the card plays the alphas fly, slowing as they
 * climb toward the nucleus and speeding off again, as energy conservation
 * says: v is proportional to the square root of 1 - d / r.
 */
function ScatteringScene({ approach }: { readonly approach: number }) {
  const playing = useVisualScene((card) => card.playing, false);
  const flights = useMemo(
    () =>
      Arr.flatMap(IMPACTS, (impact, index) => {
        const path = alphaPath(impact, approach, LIMIT, 500);
        if (path.length < 2) {
          return [];
        }
        const lengths = cumulativeLengths(path);
        return [
          {
            impact,
            lengths,
            path,
            points: Arr.map(
              path,
              ([x, y]) => [x / FEMTOMETRES, y / FEMTOMETRES, 0] as const
            ),
            ref: createRef<Mesh>(),
            // Each alpha starts at its own place, so they do not fly in a line.
            travelled: { distance: index * 17 },
          },
        ];
      }),
    [approach]
  );
  const trail = new Color(PLOT_COLORS.amber).multiplyScalar(1.4);

  useFrame((_, seconds) => {
    for (const flight of flights) {
      const total = Option.getOrElse(Arr.last(flight.lengths), constant(0));
      const [x, y] = pointAlong(
        flight.path,
        flight.lengths,
        flight.travelled.distance
      );
      flight.ref.current?.position.set(x / FEMTOMETRES, y / FEMTOMETRES, 0);
      if (playing && total > 0) {
        const step =
          SPEED *
          alphaSpeed(Math.hypot(x, y), approach) *
          Math.min(seconds, 0.1);
        flight.travelled.distance = (flight.travelled.distance + step) % total;
      }
    }
  });

  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[GOLD_NUCLEUS / FEMTOMETRES, 48, 32]} />
        <MetalMaterial color={PLOT_COLORS.amber} roughness={0.25} />
      </mesh>
      <Line
        color={getColor("SLATE", 400)}
        dashed
        dashSize={0.25}
        gapSize={0.2}
        lineWidth={1}
        points={Arr.map(Arr.range(0, 96), (step) => {
          const angle = (2 * Math.PI * step) / 96;
          return [
            (approach / FEMTOMETRES) * Math.cos(angle),
            (approach / FEMTOMETRES) * Math.sin(angle),
            0,
          ] as const;
        })}
      />
      {Arr.map(flights, (flight) => (
        <Line
          color={trail}
          key={`path-${flight.impact}`}
          lineWidth={1.4}
          opacity={0.55}
          points={flight.points}
          toneMapped={false}
          transparent
        />
      ))}
      {Arr.map(flights, (flight) => (
        <mesh key={`alpha-${flight.impact}`} ref={flight.ref}>
          <sphereGeometry args={[0.17, 20, 14]} />
          <meshStandardMaterial
            color={PLOT_COLORS.teal}
            emissive={PLOT_COLORS.teal}
            emissiveIntensity={2.6}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Looks at the nucleus from the front and a little above, the whole view in frame. */
function ScatteringCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = (LIMIT / FEMTOMETRES) * (narrow ? 3 : 2.2);
  return (
    <CameraControls
      cameraPosition={[0, distance * 0.3, distance]}
      cameraTarget={[0, 0, 0]}
      fov={40}
      maxDistance={distance * 1.8}
      minDistance={2}
    />
  );
}
