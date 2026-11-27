import { createPaddy } from "@repo/design-system/components/contents/biology/ecosystem/paddy";
import type { Herd } from "@repo/design-system/components/contents/biology/ecosystem/population";
import {
  balanceOf,
  FIELD,
  historyOf,
} from "@repo/design-system/components/contents/biology/ecosystem/population";
import { createWildlife } from "@repo/design-system/components/contents/biology/ecosystem/wildlife";
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

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
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly peak: ReactNode;
    readonly predators: ReactNode;
    readonly prey: ReactNode;
    readonly start: string;
    readonly viewLabel: string;
    readonly year: ReactNode;
  };
  readonly title: NonNullable<ReactNode>;
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
    <VisualCard
      onReset={() => {
        setOwls(10);
        setYear(YEARS);
      }}
    >
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
 * The sketch: a rice field seen from above, its rats scurrying between the
 * rows, owls gliding over them with their shadows, and the populations'
 * graph under the field.
 */
function fieldProgram(sketch: p5, read: () => Field) {
  const paddy = createPaddy();
  const wildlife = createWildlife();
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

    paddy(sketch, height);
    if (herd) {
      wildlife(
        sketch,
        {
          owls: Math.min(DRAWN.predators, Math.round(herd.predators)),
          rats: Math.min(DRAWN.prey, Math.round(herd.prey)),
        },
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
  // The whole run shows faintly across the band; the years so far draw over it.
  Arr.forEach(["prey", "predators"] as const, (kind) => {
    const faint = sketch.color(HERD_COLORS[kind]);
    faint.setAlpha(70);
    sketch.stroke(faint);
    sketch.strokeWeight(1.5);
    sketch.beginShape();
    Arr.forEach(field.history, (herd, index) => {
      sketch.vertex(x(index * EVERY), y(herd[kind]));
    });
    sketch.endShape();
    sketch.stroke(HERD_COLORS[kind]);
    sketch.strokeWeight(2.5);
    sketch.beginShape();
    Arr.forEach(
      Arr.take(field.history, Math.round(today / EVERY) + 1),
      (herd, index) => {
        sketch.vertex(x(index * EVERY), y(herd[kind]));
      }
    );
    sketch.endShape();
    const now = field.history[Math.round(today / EVERY)];
    if (now) {
      sketch.noStroke();
      sketch.fill(HERD_COLORS[kind]);
      sketch.circle(x(today), y(now[kind]), 7);
      sketch.noFill();
    }
  });
}
