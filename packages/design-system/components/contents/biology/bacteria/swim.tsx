import {
  SWIM,
  type Swimmer,
  stepSwimmer,
} from "@repo/design-system/components/contents/biology/bacteria/microbe";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import {
  UNIT,
  useQuantity,
} from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The dish is 400 µm across; the sugar crystal lies at its right edge. */
const DISH = 400;

/** The sketch runs four times faster than life, so a minute takes fifteen seconds. */
const TIME_LAPSE = 4;

/** How many recent positions each trail keeps. */
const TRAIL = 900;

/** The cell that senses sugar is teal; the cell without receptors is grey. */
const SENSING = PLOT_COLORS.teal;
const MUTANT = getColor("GRAY");

/** The two cells start side by side, 100 µm left of the middle. */
const START_X = -100;

/** What the card reads back from the sketch: how far each cell got toward the sugar. */
const ProgressSchema = Schema.Struct({
  mutant: Schema.Finite,
  seconds: Schema.Finite,
  sensing: Schema.Finite,
});
type Progress = typeof ProgressSchema.Type;

/**
 * Two Escherichia coli cells swim in a dish whose sugar comes from a crystal
 * on the right. Both run and tumble at random. One senses the sugar and keeps
 * its runs going while the sugar increases; the other's receptors are
 * missing. Over a minute the sensing cell drifts toward the food and the
 * other wanders, which is chemotaxis.
 */
export function ChemotaxisLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly elapsed: ReactNode;
    readonly mutant: ReactNode;
    readonly sensing: ReactNode;
    readonly viewLabel: string;
  };
  readonly title: ReactNode;
}) {
  const [progress, setProgress] = useState<Progress>({
    mutant: 0,
    seconds: 0,
    sensing: 0,
  });
  const quantity = useQuantity();

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="bg-card">
        <P5Sketch
          label={labels.viewLabel}
          program={swimProgram}
          state={{ report: setProgress }}
        />
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.sensing}
            value={
              <InlineMath
                math={quantity(progress.sensing, "\\,\\mu\\text{m}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.mutant}
            value={
              <InlineMath
                math={quantity(progress.mutant, "\\,\\mu\\text{m}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.elapsed}
            value={
              <InlineMath math={quantity(progress.seconds, UNIT.time, 0)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** A fresh cell at the start line, pointing a seeded random way. */
function newSwimmer(seed: number): Swimmer {
  return {
    heading: hashUnit(seed, 0) * Math.PI * 2,
    left: SWIM.run,
    runs: 0,
    tumbling: false,
    x: START_X,
    y: seed === 1 ? -40 : 40,
  };
}

/**
 * The sketch: the dish shaded by its sugar, the crystal, both trails and both
 * cells with their flagella. It reports the cells' progress to the card twice
 * a second, and starts over after two minutes of dish time.
 */
function swimProgram(
  sketch: p5,
  read: () => { readonly report: (progress: Progress) => void }
) {
  let cells = [newSwimmer(1), newSwimmer(2)] as const;
  let trails: readonly [
    readonly (readonly [number, number])[],
    readonly (readonly [number, number])[],
  ] = [[], []];
  let seconds = 0;
  let reported = 0;

  const toScreen = (x: number, y: number) => {
    const scale = Math.min(sketch.width, sketch.height) / DISH;
    return [
      sketch.width / 2 + x * scale,
      sketch.height / 2 + y * scale,
    ] as const;
  };

  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };

  sketch.draw = () => {
    const dt = Math.min(0.1, sketch.deltaTime / 1000) * TIME_LAPSE;
    seconds += dt;
    if (seconds > 120) {
      cells = [newSwimmer(1), newSwimmer(2)];
      trails = [[], []];
      seconds = 0;
    }
    cells = [
      stepSwimmer(cells[0], dt, true, (runs, salt) =>
        hashUnit(runs * 7 + 1, salt)
      ),
      stepSwimmer(cells[1], dt, false, (runs, salt) =>
        hashUnit(runs * 7 + 2, salt)
      ),
    ];
    trails = [
      Arr.takeRight(
        Arr.append(trails[0], [cells[0].x, cells[0].y] as const),
        TRAIL
      ),
      Arr.takeRight(
        Arr.append(trails[1], [cells[1].x, cells[1].y] as const),
        TRAIL
      ),
    ];

    drawDish(sketch, toScreen);
    drawTrail(sketch, trails[0], toScreen, SENSING);
    drawTrail(sketch, trails[1], toScreen, MUTANT);
    drawCell(sketch, cells[0], toScreen, SENSING, seconds);
    drawCell(sketch, cells[1], toScreen, MUTANT, seconds);

    if (seconds - reported > 0.5 || seconds < reported) {
      reported = seconds;
      read().report({
        mutant: cells[1].x - START_X,
        seconds,
        sensing: cells[0].x - START_X,
      });
    }
  };
}

/**
 * The dish's water across the whole view, yellowing toward the sugar crystal
 * as the sugar spreads from it: beyond the crystal it stays at its sweetest.
 */
function drawDish(
  sketch: p5,
  toScreen: (x: number, y: number) => readonly [number, number]
) {
  sketch.noStroke();
  const [left] = toScreen(-DISH / 2, 0);
  const [right] = toScreen(DISH / 2, 0);
  const bands = 48;
  Arr.forEach(Arr.range(0, bands - 1), (band) => {
    const x0 = (sketch.width * band) / bands;
    const x1 = (sketch.width * (band + 1)) / bands;
    const share = Math.min(
      1,
      Math.max(0, ((x0 + x1) / 2 - left) / (right - left))
    );
    sketch.fill(238 + 10 * share, 242 - 4 * share, 240 - 46 * share);
    sketch.rect(x0, 0, x1 - x0 + 1, sketch.height);
  });
  const [cx, cy] = toScreen(DISH / 2 - 8, 0);
  const size = Math.min(sketch.width, sketch.height) / DISH;
  sketch.fill(250, 236, 180);
  sketch.stroke(214, 190, 120);
  sketch.strokeWeight(1);
  sketch.rect(cx - 10 * size, cy - 26 * size, 20 * size, 52 * size, 3 * size);
}

/** A cell's path as a thin line that fades into the past. */
function drawTrail(
  sketch: p5,
  trail: readonly (readonly [number, number])[],
  toScreen: (x: number, y: number) => readonly [number, number],
  hex: string
) {
  const ink = sketch.color(hex);
  ink.setAlpha(150);
  sketch.noFill();
  sketch.strokeWeight(1.2);
  sketch.stroke(ink);
  sketch.beginShape();
  Arr.forEach(trail, ([x, y]) => {
    const [sx, sy] = toScreen(x, y);
    sketch.vertex(sx, sy);
  });
  sketch.endShape();
}

/**
 * A rod-shaped cell, 2 µm by 1 µm drawn eight times larger so the eye finds
 * it, with a bundle of flagella waving behind it while it runs.
 */
function drawCell(
  sketch: p5,
  cell: Swimmer,
  toScreen: (x: number, y: number) => readonly [number, number],
  hex: string,
  seconds: number
) {
  const [x, y] = toScreen(cell.x, cell.y);
  const size = (Math.min(sketch.width, sketch.height) / DISH) * 8;
  sketch.push();
  sketch.translate(x, y);
  sketch.rotate(cell.heading);
  const flagella = sketch.color(hex);
  flagella.setAlpha(200);
  sketch.noFill();
  sketch.stroke(flagella);
  sketch.strokeWeight(Math.max(1, size * 0.12));
  sketch.beginShape();
  Arr.forEach(Arr.range(0, 16), (step) => {
    const along = -size * 1 - (step / 16) * size * 2.2;
    const wave =
      Math.sin(step * 0.9 - seconds * (cell.tumbling ? 4 : 30)) * size * 0.22;
    sketch.vertex(along, wave);
  });
  sketch.endShape();
  sketch.noStroke();
  sketch.fill(hex);
  sketch.rectMode(sketch.CENTER);
  sketch.rect(0, 0, size * 2, size, size / 2);
  sketch.pop();
}
