import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MicroscopeField } from "@repo/design-system/components/contents/biology/bacteria/field";
import {
  cellsAfter,
  cycleProgress,
  DOUBLING_MINUTES,
  generationsAfter,
} from "@repo/design-system/components/contents/biology/bacteria/microbe";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
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
import { Array as Arr } from "effect";
import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import type { InstancedMesh } from "three";
import { MATERIAL } from "@repo/design-system/lib/material";

/** Two hours: six doublings, sixty-four cells. */
const MINUTES = 120;

/** Played, twenty minutes pass in two seconds. */
const MINUTES_PER_SECOND = 10;

/** A newborn rod: 2 µm long and 0.9 µm wide; it doubles its length before it splits. */
const NEWBORN = 2;
const RADIUS = 0.45;

/** The most cells the colony shows. */
const MOST = 2 ** (MINUTES / DOUBLING_MINUTES);

/** The scene shows the colony magnified, so a few cells fill the field. */
const MAGNIFY = 3.2;

/**
 * Where cell `index` of generation `generation` sits, and which way it
 * points: every cell lies where its parent lay, pushed half a newborn's
 * length along the parent's axis, one daughter each way, and each generation
 * turns a little, so the colony spreads as a flat cluster on the agar.
 */
function placeOf(
  generation: number,
  index: number
): readonly [number, number, number] {
  if (generation === 0) {
    return [0, 0, 0.3];
  }
  const [x, z, angle] = placeOf(generation - 1, Math.floor(index / 2));
  const side = index % 2 === 0 ? -1 : 1;
  const push = NEWBORN * 0.62;
  const turn =
    (hashUnit(generation, index) - 0.5) * 1.2 + (generation % 2) * 1.4;
  return [
    x + Math.cos(angle) * push * side,
    z + Math.sin(angle) * push * side,
    angle + turn,
  ];
}

/**
 * One cell of Escherichia coli on agar becomes a colony by binary fission:
 * each rod grows to twice its length, pinches in the middle and splits into
 * two, every twenty minutes at 37 °C. The learner scrubs or plays two hours
 * and counts the cells: 1, 2, 4, 8, … 64.
 */
export function BinaryFissionLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly cells: ReactNode;
    readonly generations: ReactNode;
    readonly minutes: string;
    readonly viewLabel: string;
  };
  readonly title: ReactNode;
}) {
  const [minutes, setMinutes] = useState(MINUTES);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.minutes}</span>
            <span className="tabular-nums">{Math.floor(minutes)}</span>
          </div>
          <Slider
            aria-label={labels.minutes}
            max={MINUTES}
            min={0}
            onValueChange={setMinutes}
            step={1}
            value={minutes}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage setting="studio" reach={60}>
          <Suspense fallback={null}>
            <FissionScene minutes={minutes} onMinutes={setMinutes} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.generations}
            value={generationsAfter(minutes)}
          />
          <VisualFactTabular label={labels.cells} value={cellsAfter(minutes)} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The colony under the microscope. Played, the scene moves the clock on and
 * hands the whole minutes to the card, so the slider and the counts follow.
 */
function FissionScene({
  minutes,
  onMinutes,
}: {
  readonly minutes: number;
  readonly onMinutes: (minutes: number) => void;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const bodies = useRef<InstancedMesh>(null);
  const caps = useRef<InstancedMesh>(null);
  const clock = useRef(minutes);
  const sent = useRef(minutes);

  // A time the learner set on the slider moves the clock; a time the scene
  // sent while playing is already on it.
  useEffect(() => {
    if (minutes !== sent.current) {
      clock.current = minutes;
      sent.current = minutes;
    }
  }, [minutes]);

  useFrame((_, delta) => {
    if (playing) {
      clock.current =
        clock.current >= MINUTES
          ? 0
          : Math.min(MINUTES, clock.current + delta * MINUTES_PER_SECOND);
      const whole = Math.floor(clock.current);
      if (whole !== sent.current) {
        sent.current = whole;
        onMinutes(whole);
      }
    }
    const time = clock.current;
    const generation = generationsAfter(time);
    const progress = time >= MINUTES ? 0 : cycleProgress(time);
    const count = cellsAfter(time);
    const length = NEWBORN * (1 + progress);
    const pinch = Math.max(0, (progress - 0.8) / 0.2);
    // Each cell is two halves that overlap by a diameter, so together they
    // read as one smooth rod; as the cell pinches the overlap closes and the
    // halves meet at two rounded ends.
    const overlap = 2 * RADIUS * (1 - pinch);
    const half = length / 2 + overlap;
    const body = Math.max(0.001, half - 2 * RADIUS);
    Arr.forEach(Arr.range(0, MOST * 2 - 1), (slot) => {
      const index = Math.floor(slot / 2);
      const side = slot % 2 === 0 ? -1 : 1;
      const shown = index < count;
      const [x, z, angle] = placeOf(generation, index);
      const centre = (length / 2 - half / 2) * side;
      const at = (along: number) =>
        [
          (x + Math.cos(angle) * along) * MAGNIFY,
          0,
          (z + Math.sin(angle) * along) * MAGNIFY,
        ] as const;
      const bodyPart = bodies.current?.children[slot];
      bodyPart?.position.set(...at(centre));
      bodyPart?.rotation.set(0, -angle, Math.PI / 2);
      bodyPart?.scale.set(
        shown ? MAGNIFY : 0,
        (body / NEWBORN) * MAGNIFY,
        shown ? MAGNIFY : 0
      );
      Arr.forEach([-1, 1] as const, (end, cap) => {
        const capPart = caps.current?.children[slot * 2 + cap];
        capPart?.position.set(...at(centre + (end * body) / 2));
        capPart?.scale.setScalar(shown ? MAGNIFY : 0);
      });
    });
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <MicroscopeField>
        <directionalLight intensity={1.2} position={[20, 60, 30]} />
        <Instances limit={MOST * 2} ref={bodies}>
          <cylinderGeometry args={[RADIUS, RADIUS, NEWBORN, 14, 1, true]} />
          <meshStandardMaterial color={MATERIAL.cellBody} roughness={0.55} />
          {Arr.map(Arr.range(1, MOST * 2), (slot) => (
            <Instance key={slot} />
          ))}
        </Instances>
        <Instances limit={MOST * 4} ref={caps}>
          <sphereGeometry args={[RADIUS, 14, 10]} />
          <meshStandardMaterial color={MATERIAL.cellBody} roughness={0.55} />
          {Arr.map(Arr.range(1, MOST * 4), (slot) => (
            <Instance key={slot} />
          ))}
        </Instances>
      </MicroscopeField>
    </>
  );
}
