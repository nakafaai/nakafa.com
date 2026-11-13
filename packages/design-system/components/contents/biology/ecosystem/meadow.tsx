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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
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
  legend: Readonly<{ predators: string; prey: string }>;
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
    readonly legend: Readonly<{ predators: string; prey: string }>;
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
  const field = useMemo(
    () => ({ history, legend: labels.legend, report: setYear }),
    [history, labels.legend]
  );
  const now = history[Math.min(history.length - 1, Math.round(year / EVERY))] ?? balanceOf(rates);
  const peak = Arr.reduce(history, 0, (most, herd) => Math.max(most, herd.prey));

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
        <P5Sketch label={labels.viewLabel} program={fieldProgram} state={field} />
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.prey}
            value={<InlineMath math={quantity(now.prey, "", 0)} />}
          />
          <VisualFactTabular
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
      drawRats(sketch, Math.min(DRAWN.prey, Math.round(herd.prey)), height, year);
      drawOwls(sketch, Math.min(DRAWN.predators, Math.round(herd.predators)), height, year);
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
    const x = (hashUnit(rat, 1) + 0.02 * Math.sin(year * 6 + rat)) * sketch.width;
    const y = 8 + (hashUnit(rat, 2) + 0.02 * Math.cos(year * 5 + rat)) * (height - 16);
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
  Arr.forEach(Arr.range(0, Math.max(0, count - 1)), (owl) => {
    const angle = year * (1.2 + hashUnit(owl, 4)) + hashUnit(owl, 5) * Math.PI * 2;
    const cx = hashUnit(owl, 6) * sketch.width;
    const cy = hashUnit(owl, 7) * height;
    const x = cx + Math.cos(angle) * 30;
    const y = cy + Math.sin(angle) * 22;
    sketch.noStroke();
    sketch.fill(getColor("ZINC", 900));
    sketch.ellipse(x + 10, y + 12, 22, 9);
    sketch.push();
    sketch.translate(x, y);
    sketch.rotate(angle + Math.PI / 2);
    sketch.fill(MATERIAL.stucco);
    sketch.ellipse(0, 0, 26, 8);
    sketch.fill(MATERIAL.furFox);
    sketch.ellipse(0, 0, 9, 12);
    sketch.pop();
  });
}

/** Both populations over the years so far, under the field. */
function drawHistory(sketch: p5, field: Field, today: number, top: number) {
  const bottom = sketch.height - 24;
  const left = 12;
  const right = sketch.width - 12;
  const most = Arr.reduce(field.history, 1, (high, herd) => Math.max(high, herd.prey));
  const x = (year: number) => left + ((right - left) * year) / YEARS;
  const y = (count: number) => bottom - ((bottom - top - 12) * count) / most;
  sketch.noStroke();
  sketch.fill(getColor("SLATE", 50));
  sketch.rect(0, top, sketch.width, sketch.height - top);
  sketch.noFill();
  sketch.strokeWeight(2);
  Arr.forEach(["prey", "predators"] as const, (kind) => {
    sketch.stroke(HERD_COLORS[kind]);
    sketch.beginShape();
    Arr.forEach(Arr.take(field.history, Math.round(today / EVERY) + 1), (herd, index) => {
      sketch.vertex(x(index * EVERY), y(herd[kind]));
    });
    sketch.endShape();
  });
  sketch.noStroke();
  sketch.textSize(11);
  sketch.textAlign(sketch.LEFT, sketch.CENTER);
  Arr.forEach(["prey", "predators"] as const, (kind, index) => {
    const lx = left + index * Math.max(90, (right - left) / 3);
    sketch.fill(HERD_COLORS[kind]);
    sketch.circle(lx + 5, sketch.height - 9, 8);
    sketch.fill(getColor("GRAY", 800));
    sketch.text(field.legend[kind], lx + 13, sketch.height - 9);
  });
}
