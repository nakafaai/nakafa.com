import type { Swimmer } from "@repo/design-system/components/contents/biology/bacteria/microbe";
import {
  SWIM,
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
import type { ReactNode } from "react";
import { useState } from "react";

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
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly elapsed: ReactNode;
    readonly mutant: ReactNode;
    readonly sensing: ReactNode;
    readonly viewLabel: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [progress, setProgress] = useState<Progress>({
    mutant: 0,
    seconds: 0,
    sensing: 0,
  });
  const quantity = useQuantity();

  const resetProgress = () => {
    setProgress({
      mutant: 0,
      seconds: 0,
      sensing: 0,
    });
  };

  return (
    <VisualCard onReset={resetProgress} onStop={resetProgress}>
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
 * The dish as dark-field microscopy shows it: black water, with the sugar
 * that spreads from the crystal scattering a faint glow that brightens toward
 * it, and the crystal itself as a bright, faceted grain.
 */
function drawDish(
  sketch: p5,
  toScreen: (x: number, y: number) => readonly [number, number]
) {
  sketch.background(8, 10, 12);
  sketch.noStroke();
  const [cx, cy] = toScreen(DISH / 2 - 8, 0);
  const size = Math.min(sketch.width, sketch.height) / DISH;
  Arr.forEach(Arr.range(0, 71), (ring) => {
    const reach = (72 - ring) * 4.6 * size;
    sketch.fill(212, 196, 140, 2 + ring * 0.18);
    sketch.ellipse(cx, cy, reach * 2.4, reach * 2);
  });
  const facets = [
    [0, -28],
    [11, -16],
    [10, 20],
    [-2, 27],
    [-11, 12],
    [-9, -18],
  ] as const;
  sketch.fill(250, 244, 220);
  sketch.stroke(255, 252, 238);
  sketch.strokeWeight(Math.max(1, size));
  sketch.beginShape();
  Arr.forEach(facets, ([fx, fy]) =>
    sketch.vertex(cx + fx * size, cy + fy * size)
  );
  sketch.endShape(sketch.CLOSE);
  sketch.stroke(200, 186, 140, 180);
  sketch.line(cx, cy - 28 * size, cx + size, cy + 4 * size);
  sketch.line(cx + size, cy + 4 * size, cx - 2 * size, cy + 27 * size);
  Arr.forEach(Arr.range(0, 40), (index) => {
    const [dx, dy] = toScreen(
      (hashUnit(index, 51) - 0.5) * DISH,
      (hashUnit(index, 53) - 0.5) * DISH
    );
    sketch.noStroke();
    sketch.fill(180, 186, 190, 40 + hashUnit(index, 57) * 60);
    sketch.circle(dx, dy, 1 + hashUnit(index, 59) * 2);
  });
}

/** A cell's path as a thin line that fades into the past. */
function drawTrail(
  sketch: p5,
  trail: readonly (readonly [number, number])[],
  toScreen: (x: number, y: number) => readonly [number, number],
  hex: string
) {
  const ink = sketch.color(hex);
  ink.setAlpha(90);
  sketch.noFill();
  sketch.strokeWeight(1);
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
  // Dark-field light scatters off the cell's edge, so it glows with a soft
  // halo around a brighter rim.
  sketch.noStroke();
  sketch.rectMode(sketch.CENTER);
  const glow = sketch.color(hex);
  Arr.forEach([2.2, 1.6, 1.25] as const, (spread, layer) => {
    glow.setAlpha(28 + layer * 26);
    sketch.fill(glow);
    sketch.rect(0, 0, size * 2 * spread, size * spread, (size * spread) / 2);
  });
  sketch.fill(sketch.lerpColor(sketch.color(hex), sketch.color(255), 0.55));
  sketch.rect(0, 0, size * 2, size, size / 2);
  sketch.pop();
}
