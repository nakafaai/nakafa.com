import {
  fade,
  gradientRect,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import { scientific } from "@repo/design-system/components/contents/physics/measurement/figures";
import {
  SHEET_THICKNESS,
  StackSchema,
  stackReading,
} from "@repo/design-system/components/contents/physics/measurement/paper/stack";
import {
  steelStops,
  tier,
} from "@repo/design-system/components/contents/physics/measurement/scale";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How tall the ruler stands, in millimetres. */
const RULER_MILLIMETRES = 130;

/** The half height of the magnifier's window around the stack's top, in millimetres. */
const LENS_HALF = 3;

/** How quickly the stack grows or shrinks to a new count, per second. */
const GROW_RATE = 5;

/** What the sketch reads on every frame: how many sheets are stacked. */
const StackFrame = Schema.Struct({ stack: StackSchema });

/** Positions of the bench, the stack, the ruler and the magnifier for one canvas size. */
function layout(sketch: p5) {
  const { height, width } = sketch;
  const lens = Math.min(width * 0.4, height * 0.84);
  return {
    base: height * 0.86,
    lens,
    lensLeft: width * 0.97 - lens,
    lensTop: (height - lens) / 2,
    millimetre: (height * 0.74) / RULER_MILLIMETRES,
    ruler: width * 0.36,
    stackLeft: width * 0.08,
    stackWidth: width * 0.26,
  };
}

/** The wall, the bench and the lamp. */
function paintRoom(sketch: p5, place: ReturnType<typeof layout>) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(getColor("NEUTRAL", 700), getColor("WHITE"), 0.12)],
    [1, getColor("NEUTRAL", 800)],
  ]);
  spotlight(sketch, { x: width * 0.25, y: height * 0.3 }, width * 0.5, {
    color: MATERIAL.lampLight,
    strength: 0.3,
  });
  gradientRect(
    sketch,
    { height: height - place.base, width, x: 0, y: place.base },
    [
      [0, mix(getColor("STONE", 600), getColor("WHITE"), 0.2)],
      [1, mix(getColor("STONE", 600), getColor("BLACK"), 0.5)],
    ]
  );
}

/** The stack of paper `stackHeight` millimetres tall, its edge lined with sheets. */
function paintStack(
  sketch: p5,
  place: ReturnType<typeof layout>,
  stackHeight: number
) {
  const tall = stackHeight * place.millimetre;
  const top = place.base - tall;
  const depth = sketch.height * 0.05;
  const paper = MATERIAL.paper;
  withShadow(
    sketch,
    { blur: 20, color: fade(getColor("BLACK"), 0.55), drop: 8 },
    () => {
      gradientRect(
        sketch,
        {
          height: Math.max(tall, 1),
          width: place.stackWidth,
          x: place.stackLeft,
          y: top,
        },
        [
          [0, paper],
          [1, mix(paper, getColor("SLATE", 300), 0.6)],
        ],
        true
      );
    }
  );
  sketch.fill(mix(paper, getColor("WHITE"), 0.5));
  sketch.quad(
    place.stackLeft,
    top,
    place.stackLeft + place.stackWidth,
    top,
    place.stackLeft + place.stackWidth + depth,
    top - depth * 0.45,
    place.stackLeft + depth,
    top - depth * 0.45
  );
  const sheetPixels = SHEET_THICKNESS * place.millimetre;
  const every = Math.max(Math.ceil(2 / sheetPixels), 1);
  sketch.stroke(fade(getColor("SLATE", 400), 0.45));
  sketch.strokeWeight(0.6);
  for (let y = place.base; y > top + 0.5; y -= sheetPixels * every) {
    sketch.line(place.stackLeft, y, place.stackLeft + place.stackWidth, y);
  }
  sketch.noStroke();
}

/** The steel ruler standing on the bench beside the stack. */
function paintRuler(sketch: p5, place: ReturnType<typeof layout>) {
  const wide = sketch.width * 0.045;
  const tall = RULER_MILLIMETRES * place.millimetre;
  withShadow(
    sketch,
    { blur: 14, color: fade(getColor("BLACK"), 0.5), drop: 6 },
    () => {
      gradientRect(
        sketch,
        { height: tall, width: wide, x: place.ruler, y: place.base - tall },
        steelStops(),
        true
      );
    }
  );
  sketch.push();
  sketch.stroke(fade(getColor("ZINC", 900), 0.8));
  sketch.strokeWeight(1);
  for (let millimetre = 0; millimetre <= RULER_MILLIMETRES; millimetre += 2) {
    const y = place.base - millimetre * place.millimetre;
    sketch.line(
      place.ruler,
      y,
      place.ruler + wide * (millimetre % 10 === 0 ? 0.55 : 0.3),
      y
    );
  }
  sketch.pop();
}

/**
 * The magnifier on the top of the stack: the ruler's millimetres, single
 * sheets, and the mark the top is read at.
 */
function paintLens(
  sketch: p5,
  place: ReturnType<typeof layout>,
  stackHeight: number,
  reading: number
) {
  const scale = place.lens / (LENS_HALF * 2);
  const centre = place.lensTop + place.lens / 2;
  const toY = (millimetre: number) =>
    centre - (millimetre - stackHeight) * scale;
  withShadow(
    sketch,
    { blur: 24, color: fade(getColor("BLACK"), 0.7), drop: 10 },
    () => {
      sketch.fill(getColor("ZINC", 900));
      sketch.rect(place.lensLeft, place.lensTop, place.lens, place.lens, 14);
    }
  );
  sketch.push();
  const drawing = sketch.drawingContext;
  if (drawing instanceof CanvasRenderingContext2D) {
    drawing.beginPath();
    drawing.roundRect(
      place.lensLeft,
      place.lensTop,
      place.lens,
      place.lens,
      14
    );
    drawing.clip();
  }
  gradientRect(
    sketch,
    {
      height: place.lens,
      width: place.lens,
      x: place.lensLeft,
      y: place.lensTop,
    },
    [
      [0, mix(getColor("NEUTRAL", 700), getColor("WHITE"), 0.15)],
      [1, getColor("NEUTRAL", 800)],
    ]
  );
  const paperRight = place.lensLeft + place.lens * 0.62;
  const paper = MATERIAL.paper;
  const top = toY(stackHeight);
  gradientRect(
    sketch,
    {
      height: place.lensTop + place.lens - top,
      width: paperRight - place.lensLeft,
      x: place.lensLeft,
      y: top,
    },
    [
      [0, paper],
      [1, mix(paper, getColor("SLATE", 300), 0.4)],
    ],
    true
  );
  sketch.stroke(fade(getColor("SLATE", 400), 0.7));
  sketch.strokeWeight(1);
  for (let sheet = 0; sheet * SHEET_THICKNESS < LENS_HALF * 1.1; sheet += 1) {
    const y = top + sheet * SHEET_THICKNESS * scale;
    sketch.line(place.lensLeft, y, paperRight, y);
  }
  gradientRect(
    sketch,
    {
      height: place.lens,
      width: place.lens * 0.3,
      x: paperRight + place.lens * 0.04,
      y: place.lensTop,
    },
    steelStops(),
    true
  );
  const first = Math.ceil(stackHeight - LENS_HALF);
  paintTicksDown(
    sketch,
    paperRight + place.lens * 0.04,
    toY,
    first,
    Math.floor(stackHeight + LENS_HALF),
    place.lens * 0.3
  );
  sketch.stroke(PLOT_COLORS.fuchsia);
  sketch.strokeWeight(4);
  sketch.line(
    paperRight - place.lens * 0.1,
    toY(reading),
    paperRight + place.lens * 0.25,
    toY(reading)
  );
  sketch.noStroke();
  sketch.pop();
}

/** The ruler's millimetre marks from `first` to `last` in the magnifier, longer every 5 and 10. */
function paintTicksDown(
  sketch: p5,
  x: number,
  toY: (millimetre: number) => number,
  first: number,
  last: number,
  wide: number
) {
  sketch.stroke(getColor("ZINC", 900));
  for (let millimetre = first; millimetre <= last; millimetre += 1) {
    sketch.strokeWeight(millimetre % 5 === 0 ? 3 : 2);
    sketch.line(
      x,
      toY(millimetre),
      x + wide * tier(millimetre, [10, 5], [0.6, 0.45, 0.3]),
      toY(millimetre)
    );
  }
  sketch.noStroke();
}

/** Draws one moment: the stack grows to its count, and the magnifier reads its top. */
function stackProgram(sketch: p5, read: () => typeof StackFrame.Type) {
  let shown = stackReading(read().stack).sheets * SHEET_THICKNESS;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const reading = stackReading(read().stack);
    const target = reading.sheets * SHEET_THICKNESS;
    const step = Math.min(sketch.deltaTime / 1000, 0.1) * GROW_RATE;
    shown = sketch.isLooping()
      ? shown + (target - shown) * Math.min(step, 1)
      : target;
    const place = layout(sketch);
    paintRoom(sketch, place);
    paintStack(sketch, place, shown);
    paintRuler(sketch, place);
    const top = place.base - shown * place.millimetre;
    const window = LENS_HALF * place.millimetre;
    sketch.noFill();
    sketch.stroke(fade(PLOT_COLORS.fuchsia, 0.85));
    sketch.strokeWeight(1.5);
    sketch.rect(
      place.stackLeft + place.stackWidth * 0.7,
      top - window,
      place.ruler -
        place.stackLeft -
        place.stackWidth * 0.7 +
        sketch.width * 0.045,
      window * 2,
      3
    );
    sketch.line(
      place.ruler + sketch.width * 0.045,
      top - window,
      place.lensLeft,
      place.lensTop
    );
    sketch.line(
      place.ruler + sketch.width * 0.045,
      top + window,
      place.lensLeft,
      place.lensTop + place.lens
    );
    sketch.noStroke();
    paintLens(sketch, place, shown, reading.height);
    vignette(sketch, 0.35);
  };
}

interface PaperStackLabProps {
  description: ReactNode;
  labels: {
    chooseStack: string;
    figures: ReactNode;
    reading: ReactNode;
    sheet: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A stack of paper beside a millimetre ruler. Stack more sheets: the reading
 * gains digits, and one sheet's thickness, the reading over the exact count,
 * gains significant figures in its coefficient.
 */
export function PaperStackLab({
  description,
  labels,
  title,
}: PaperStackLabProps) {
  const [stack, setStack] = useState<typeof StackSchema.Type>("500");
  const fixed = useFixed();
  const reading = stackReading(stack);
  const sheet = scientific(reading.sheet, reading.figures);
  const isStack = Schema.is(StackSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseStack}
          gridColumns="4"
          onValueChange={(value) => {
            if (isStack(value)) {
              setStack(value);
            }
          }}
          type="single"
          value={stack}
          variant="outline"
        >
          {Arr.map(StackSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              <InlineMath math={`N=${option}`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={stackProgram}
          state={{ stack }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.reading}
            value={
              <InlineMath math={fixed(reading.height, "\\text{ mm}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.figures}
            value={<InlineMath math={`${reading.figures}`} />}
          />
          <VisualFactTabular
            label={labels.sheet}
            value={
              <InlineMath
                math={`\\frac{${fixed(reading.height, "\\text{ mm}", 0)}}{${reading.sheets}}=${fixed(sheet.coefficient, "", reading.figures - 1)}\\times10^{${sheet.exponent}}\\text{ m}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
