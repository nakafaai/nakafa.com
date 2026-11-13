import {
  balanceOf,
  FIELD,
  type Herd,
  historyOf,
} from "@repo/design-system/components/contents/biology/ecosystem/population";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Slider } from "@repo/design-system/components/ui/slider";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type p5 from "p5";
import { type ReactNode, useMemo, useState } from "react";

/** The years the card follows, sampled every tenth of a year. */
const YEARS = 20;
const EVERY = 0.1;

/** Played, a year passes in a second and a half. */
const YEARS_PER_SECOND = 1 / 1.5;

/** The rats the field starts with. */
const START_PREY = 150;

/** At most this many animals are drawn, so a plague of rats stays readable. */
const DRAWN = { predators: 60, prey: 320 } as const;

/** What the sketch reads from the card on every frame. */
type Field = Readonly<{
  history: readonly Herd[];
  report: (year: number) => void;
}>;

/**
 * A rice field seen from above, with the rats that eat its grain and the barn
 * owls that hunt them, as the Lotka-Volterra model runs them over 20 years.
 * The reader sets how many owls the field starts with. With `capacity`, the
 * rice can feed only that many rats, so the swings calm toward a balance;
 * without it, rats and owls cycle for ever. A graph under the field draws
 * both populations as they go.
 */
export function PredatorPreyLab({
  capacity,
  description,
  labels,
  title,
}: {
  readonly capacity?: number;
  readonly description: ReactNode;
  readonly labels: {
    readonly peak: ReactNode;
    readonly predators: ReactNode;
    readonly prey: ReactNode;
    readonly start: string;
    readonly viewLabel: string;
    readonly year: ReactNode;
  };
  readonly title: ReactNode;
}) {
  const [owls, setOwls] = useState(10);
  const [year, setYear] = useState(YEARS);
  const quantity = useQuantity();
  const rates = useMemo(
    () => ({ ...FIELD, capacity: capacity ?? Number.POSITIVE_INFINITY }),
    [capacity]
  );
  const history = useMemo(
    () => historyOf({ predators: owls, prey: START_PREY }, rates, YEARS, EVERY),
    [owls, rates]
  );
  const field = useMemo(() => ({ history, report: setYear }), [history]);
  const now =
    history[Math.min(history.length - 1, Math.round(year / EVERY))] ??
    balanceOf(rates);
  const peak = Arr.reduce(history, 0, (most, herd) =>
    Math.max(most, herd.prey)
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.start}</span>
            <span className="tabular-nums">{owls}</span>
          </div>
          <Slider
            aria-label={labels.start}
            max={40}
            min={2}
            onValueChange={setOwls}
            step={1}
            value={owls}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody className="bg-card">
        <P5Sketch
          label={labels.viewLabel}
          program={fieldProgram}
          state={field}
        />
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={HERD_COLORS.prey}
            label={labels.prey}
            value={<InlineMath math={quantity(now.prey, "", 0)} />}
          />
          <VisualFactIndicator
            indicatorColor={HERD_COLORS.predators}
            label={labels.predators}
            value={<InlineMath math={quantity(now.predators, "", 0)} />}
          />
          <VisualFactTabular
            label={labels.peak}
            value={<InlineMath math={quantity(peak, "", 0)} />}
          />
          <VisualFactTabular
            label={labels.year}
            value={<InlineMath math={quantity(year, "", 1)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** The two populations' mark colours. */
const HERD_COLORS = {
  predators: PLOT_COLORS.violet,
  prey: PLOT_COLORS.amber,
} as const;

/**
 * The sketch: rows of rice in flooded paddies split by earthen dikes, rats
 * scurrying between the rows, owls gliding over them with their shadows, and
 * the populations' graph under the field.
 */
function fieldProgram(sketch: p5, read: () => Field) {
  let year = 0;
  let reported = -1;
  let shown: Field | undefined;

  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };

  sketch.draw = () => {
    const field = read();
    if (field !== shown) {
      shown = field;
      year = 0;
    }
    year += Math.min(0.1, sketch.deltaTime / 1000) * YEARS_PER_SECOND;
    if (year > YEARS + 2) {
      year = 0;
    }
    const today = Math.min(YEARS, year);
    const herd = field.history[Math.round(today / EVERY)] ?? field.history[0];
    const height = sketch.height * 0.7;

    drawPaddy(sketch, height);
    if (herd) {
      drawRats(
        sketch,
        Math.min(DRAWN.prey, Math.round(herd.prey)),
        height,
        year
      );
      drawOwls(
        sketch,
        Math.min(DRAWN.predators, Math.round(herd.predators)),
        height,
        year
      );
    }
    drawHistory(sketch, field, today, height);

    const tenth = Math.round(today * 2) / 2;
    if (tenth !== reported) {
      reported = tenth;
      field.report(tenth);
    }
  };
}

/** Flooded paddies with rows of rice, split by dikes. */
function drawPaddy(sketch: p5, height: number) {
  sketch.clear();
  sketch.noStroke();
  sketch.fill(MATERIAL.mud);
  sketch.rect(0, 0, sketch.width, height);
  const plots = 3;
  const dike = Math.max(4, sketch.width * 0.012);
  Arr.forEach(Arr.range(0, plots - 1), (plot) => {
    const left = (sketch.width / plots) * plot + dike / 2;
    const right = (sketch.width / plots) * (plot + 1) - dike / 2;
    sketch.fill(MATERIAL.seawaterDeep);
    sketch.rect(left, dike, right - left, height - dike * 2);
    const rows = Math.max(6, Math.round((right - left) / 14));
    sketch.stroke(MATERIAL.foliageLight);
    sketch.strokeWeight(2);
    Arr.forEach(Arr.range(0, rows - 1), (row) => {
      const x = left + ((row + 0.5) * (right - left)) / rows;
      Arr.forEach(Arr.range(0, Math.round(height / 10)), (clump) => {
        const y = dike + clump * 10 + 4;
        if (y < height - dike) {
          sketch.line(x - 2, y + 3, x, y - 3);
          sketch.line(x + 2, y + 3, x, y - 3);
        }
      });
    });
    sketch.noStroke();
  });
}

/** Rats as small brown bodies with tails, wandering between the rows. */
function drawRats(sketch: p5, count: number, height: number, year: number) {
  sketch.noStroke();
  Arr.forEach(Arr.range(0, Math.max(0, count - 1)), (rat) => {
    const x =
      (hashUnit(rat, 1) + 0.02 * Math.sin(year * 6 + rat)) * sketch.width;
    const y =
      8 + (hashUnit(rat, 2) + 0.02 * Math.cos(year * 5 + rat)) * (height - 16);
    const heading = hashUnit(rat, 3) * Math.PI * 2 + Math.sin(year * 3 + rat);
    sketch.push();
    sketch.translate(x, y);
    sketch.rotate(heading);
    sketch.fill(MATERIAL.fur);
    sketch.ellipse(0, 0, 9, 5);
    sketch.stroke(MATERIAL.fur);
    sketch.strokeWeight(1);
    sketch.line(-4, 0, -9, 1.5);
    sketch.noStroke();
    sketch.pop();
  });
}

/** Barn owls gliding in wide circles, each over its own shadow. */
function drawOwls(sketch: p5, count: number, height: number, year: number) {
  const size = Math.max(0.6, Math.min(sketch.width, height) / 360);
  Arr.forEach(Arr.range(0, Math.max(0, count - 1)), (owl) => {
    const angle =
      year * (1.2 + hashUnit(owl, 4)) + hashUnit(owl, 5) * Math.PI * 2;
    const cx = hashUnit(owl, 6) * sketch.width;
    const cy = hashUnit(owl, 7) * height;
    const x = cx + Math.cos(angle) * 30;
    const y = cy + Math.sin(angle) * 22;
    const heading = angle + Math.PI / 2;
    const shade = sketch.color(getColor("ZINC", 900));
    shade.setAlpha(90);
    drawOwl(
      sketch,
      x + 10 * size,
      y + 12 * size,
      heading,
      size,
      shade,
      shade,
      shade
    );
    drawOwl(
      sketch,
      x,
      y,
      heading,
      size,
      sketch.color(MATERIAL.owlWing),
      sketch.color(MATERIAL.owlWingTip),
      sketch.color(MATERIAL.owlBack)
    );
  });
}

/**
 * A barn owl seen from above as it glides along `heading`: two long, broad
 * wings spread wide with darker tips, a pale back and a round head in front.
 */
function drawOwl(
  sketch: p5,
  x: number,
  y: number,
  heading: number,
  size: number,
  wing: ReturnType<p5["color"]>,
  tip: ReturnType<p5["color"]>,
  back: ReturnType<p5["color"]>
) {
  sketch.push();
  sketch.translate(x, y);
  sketch.rotate(heading);
  sketch.scale(size);
  sketch.noStroke();
  Arr.forEach([-1, 1], (side) => {
    sketch.fill(wing);
    sketch.beginShape();
    sketch.vertex(3, side * 2);
    sketch.vertex(1, side * 12);
    sketch.vertex(-2, side * 21);
    sketch.vertex(-6, side * 20);
    sketch.vertex(-5, side * 9);
    sketch.vertex(-4, side * 2);
    sketch.endShape();
    sketch.fill(tip);
    sketch.beginShape();
    sketch.vertex(0, side * 16);
    sketch.vertex(-2, side * 21);
    sketch.vertex(-6, side * 20);
    sketch.vertex(-5.5, side * 15);
    sketch.endShape();
  });
  sketch.fill(back);
  sketch.ellipse(-1, 0, 13, 7);
  sketch.ellipse(5.5, 0, 6, 6);
  sketch.triangle(-7, -2, -7, 2, -11, 0);
  sketch.pop();
}

/** Both populations over the years so far, under the field. */
function drawHistory(sketch: p5, field: Field, today: number, top: number) {
  const bottom = sketch.height - 10;
  const left = 12;
  const right = sketch.width - 12;
  const most = Arr.reduce(field.history, 1, (high, herd) =>
    Math.max(high, herd.prey)
  );
  const x = (year: number) => left + ((right - left) * year) / YEARS;
  const y = (count: number) => bottom - ((bottom - top - 12) * count) / most;
  sketch.noFill();
  sketch.strokeWeight(2);
  Arr.forEach(["prey", "predators"] as const, (kind) => {
    sketch.stroke(HERD_COLORS[kind]);
    sketch.beginShape();
    Arr.forEach(
      Arr.take(field.history, Math.round(today / EVERY) + 1),
      (herd, index) => {
        sketch.vertex(x(index * EVERY), y(herd[kind]));
      }
    );
    sketch.endShape();
  });
}
