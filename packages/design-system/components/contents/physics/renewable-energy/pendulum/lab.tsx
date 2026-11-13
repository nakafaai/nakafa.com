import { advanceRun } from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  dashed,
  fade,
  gradientRect,
  litBall,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  type Drag,
  DragSchema,
  DURATION,
  LENGTH,
  START_ENERGY,
  STEP,
  type Swing,
  simulateSwing,
  swingAt,
  swingEnergies,
} from "@repo/design-system/components/contents/physics/renewable-energy/pendulum/swing";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useMemo, useState } from "react";

/** The moment the facts read, in seconds after the release. */
const READ_TIME = 10;

/** How long the last moment rests before the bob is let go again, in seconds. */
const HOLD_SECONDS = 1.5;

/** The color of each store, shared by the chart and the facts. */
const STORE_COLORS = {
  heat: PLOT_COLORS.pink,
  kinetic: PLOT_COLORS.teal,
  potential: PLOT_COLORS.amber,
} as const;

/** What the sketch reads on every frame: the run for the chosen drag. */
interface PendulumFrame {
  readonly drag: Drag;
  readonly run: readonly Swing[];
}

/** The lab wall, the beam the string hangs from, and the floor under the bob. */
function paintLab(sketch: p5, pivot: { x: number; y: number }, floor: number) {
  const { height, width } = sketch;
  gradientRect(sketch, { height: floor, width, x: 0, y: 0 }, [
    [0, getColor("SLATE", 700)],
    [1, mix(getColor("SLATE", 700), getColor("SLATE", 400), 0.35)],
  ]);
  spotlight(sketch, { x: pivot.x, y: floor * 0.55 }, width * 0.45, {
    color: mix(PLOT_COLORS.amber, getColor("WHITE"), 0.8),
    strength: 0.25,
  });
  gradientRect(sketch, { height: height - floor, width, x: 0, y: floor }, [
    [0, mix(getColor("STONE", 600), getColor("WHITE"), 0.2)],
    [1, mix(getColor("STONE", 600), getColor("BLACK"), 0.6)],
  ]);
  withShadow(
    sketch,
    { blur: 12, color: fade(getColor("BLACK"), 0.6), drop: 5 },
    () => {
      gradientRect(
        sketch,
        {
          height: height * 0.04,
          width: width * 0.36,
          x: pivot.x - width * 0.18,
          y: pivot.y - height * 0.04,
        },
        [
          [0, getColor("SLATE", 300)],
          [1, getColor("SLATE", 600)],
        ]
      );
    }
  );
}

/** The bob on its string, its shadow sliding on the floor below. */
function paintBob(
  sketch: p5,
  pivot: { x: number; y: number },
  metre: number,
  floor: number,
  angle: number
) {
  const bob = {
    x: pivot.x + Math.sin(angle) * LENGTH * metre,
    y: pivot.y + Math.cos(angle) * LENGTH * metre,
  };
  const radius = Math.max(metre * 0.13, 9);
  sketch.fill(fade(getColor("BLACK"), 0.35));
  sketch.ellipse(bob.x, floor + 3, radius * 2.6, radius * 0.5);
  sketch.stroke(getColor("ZINC", 100));
  sketch.strokeWeight(1.5);
  sketch.line(pivot.x, pivot.y, bob.x, bob.y);
  sketch.noStroke();
  withShadow(
    sketch,
    { blur: 16, color: fade(getColor("BLACK"), 0.55), drop: 8 },
    () => {
      litBall(sketch, bob, radius, {
        dark: mix(PLOT_COLORS.amber, getColor("BLACK"), 0.55),
        light: mix(PLOT_COLORS.amber, getColor("WHITE"), 0.7),
      });
    }
  );
}

/**
 * The three stores over the run as stacked bands, potential, kinetic and
 * heat, drawn up to the present: their top edge never moves, because their
 * sum is the energy the bob started with.
 */
function paintStores(sketch: p5, run: readonly Swing[], now: number) {
  const { height, width } = sketch;
  const chart = {
    height: height * 0.42,
    left: width * 0.6,
    top: height * 0.12,
    width: width * 0.34,
  };
  sketch.fill(fade(getColor("ZINC", 950), 0.4));
  sketch.rect(
    chart.left - 10,
    chart.top - 10,
    chart.width + 20,
    chart.height + 20,
    8
  );
  const scale = chart.height / (START_ENERGY * 1.1);
  const base = chart.top + chart.height;
  const columns = Math.round(chart.width / 2);
  for (let column = 0; column < columns; column += 1) {
    const time = (column / columns) * DURATION;
    if (time > now) {
      break;
    }
    const energies = swingEnergies(swingAt(run, time));
    const x = chart.left + column * 2;
    let top = base;
    for (const store of ["potential", "kinetic", "heat"] as const) {
      const tall = energies[store] * scale;
      sketch.fill(STORE_COLORS[store]);
      sketch.rect(x, top - tall, 2.2, tall);
      top -= tall;
    }
  }
  dashed(
    sketch,
    { x: chart.left, y: base - START_ENERGY * scale },
    { x: chart.left + chart.width, y: base - START_ENERGY * scale },
    {
      color: fade(getColor("WHITE"), 0.8),
      dash: 5,
      weight: 1.5,
    }
  );
  sketch.stroke(fade(getColor("WHITE"), 0.6));
  sketch.strokeWeight(1);
  sketch.line(chart.left, base, chart.left + chart.width, base);
  sketch.noStroke();
}

/** Draws the swing in real time beside the chart of its energy stores. */
function pendulumProgram(sketch: p5, read: () => PendulumFrame) {
  let time = 0;
  let shown: Drag | undefined;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { drag, run } = read();
    if (shown !== drag) {
      shown = drag;
      time = sketch.isLooping() ? 0 : READ_TIME;
    }
    if (sketch.isLooping()) {
      time = advanceRun(time, sketch.deltaTime / 1000, {
        duration: DURATION,
        hold: HOLD_SECONDS,
        rate: 1,
      });
    }
    const now = Math.min(time, DURATION - STEP);
    const { height, width } = sketch;
    const floor = height * 0.9;
    const pivot = { x: width * 0.3, y: height * 0.1 };
    const metre = (floor - pivot.y) / (LENGTH + 0.35);
    paintLab(sketch, pivot, floor);
    paintBob(sketch, pivot, metre, floor, swingAt(run, now).angle);
    paintStores(sketch, run, now);
    vignette(sketch, 0.35);
  };
}

interface PendulumEnergyLabProps {
  description: ReactNode;
  /** The drag the bob swings against first. */
  drag?: Drag;
  labels: {
    chooseDrag: string;
    drags: Record<Drag, ReactNode>;
    heat: ReactNode;
    kinetic: ReactNode;
    potential: ReactNode;
    start: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A 1 kg bob on a 2 m string, let go from 40°, beside a chart of its energy
 * stores. Without drag, potential and kinetic energy trade back and forth
 * forever. With drag, heat in the surroundings grows while the swing dies
 * down, and the three bands always stack to the same 4.59 J.
 */
export function PendulumEnergyLab({
  description,
  drag: initialDrag = "light",
  labels,
  title,
}: PendulumEnergyLabProps) {
  const [drag, setDrag] = useState<Drag>(initialDrag);
  const measure = useQuantity();
  const run = useMemo(() => simulateSwing(drag), [drag]);
  const read = swingEnergies(swingAt(run, READ_TIME));
  const isDrag = Schema.is(DragSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseDrag}
          gridColumns="3"
          onValueChange={(value) => {
            if (isDrag(value)) {
              setDrag(value);
            }
          }}
          type="single"
          value={drag}
          variant="outline"
        >
          {Arr.map(DragSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.drags[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={pendulumProgram}
          state={{ drag, run }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.start}
            value={<InlineMath math={measure(START_ENERGY, "\\text{ J}", 2)} />}
          />
          <VisualFactIndicator
            indicatorColor={STORE_COLORS.potential}
            label={labels.potential}
            value={
              <InlineMath math={measure(read.potential, "\\text{ J}", 2)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={STORE_COLORS.kinetic}
            label={labels.kinetic}
            value={<InlineMath math={measure(read.kinetic, "\\text{ J}", 2)} />}
          />
          <VisualFactIndicator
            indicatorColor={STORE_COLORS.heat}
            label={labels.heat}
            value={<InlineMath math={measure(read.heat, "\\text{ J}", 2)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
