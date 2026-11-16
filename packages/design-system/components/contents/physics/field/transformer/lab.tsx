import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  gradientRect,
  mix,
  spotlight,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  paintBoard,
  paintBulb,
  wire,
} from "@repo/design-system/components/contents/physics/circuit/board";
import { transformer } from "@repo/design-system/components/contents/physics/field/magnet";
import {
  useQuantity,
  useReading,
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";

/** The most turns either coil is drawn with; the coils keep the turns ratio up to this. */
const MOST_TURNS = 20;

/** What the sketch reads on every frame. */
const TransformerFrameSchema = Schema.Struct({
  efficiency: Schema.Finite,
  input: Schema.Finite,
  lost: Schema.Finite,
  output: Schema.Finite,
  ratio: Schema.Finite,
  readings: Schema.Array(Schema.String),
});
type TransformerFrame = typeof TransformerFrameSchema.Type;

/** One coil of copper turns wound round a limb of the core, from `top` to `bottom` at `x`. */
function paintCoil(
  sketch: p5,
  x: number,
  span: { readonly bottom: number; readonly top: number },
  turns: number,
  width: number
) {
  const gap = (span.bottom - span.top) / turns;
  sketch.noFill();
  for (let turn = 0; turn < turns; turn += 1) {
    const y = span.top + gap * (turn + 0.5);
    sketch.stroke(mix(MATERIAL.copper, getColor("BLACK"), 0.35));
    sketch.strokeWeight(Math.max(2, gap * 0.7));
    sketch.line(x - width / 2, y, x + width / 2, y);
    sketch.stroke(mix(MATERIAL.copper, getColor("WHITE"), 0.3));
    sketch.strokeWeight(Math.max(1, gap * 0.25));
    sketch.line(x - width / 2, y - gap * 0.12, x + width / 2, y - gap * 0.12);
  }
}

/**
 * Draws the transformer on its board: the laminated iron core, the primary
 * coil with more turns on the left and the secondary on the right in the
 * turns ratio, the bulb lit on the secondary, the faint glow of the heat the
 * core wastes, and three bars, each with its value in watts, for the power
 * in, the power out and the power lost, in the order the facts list them.
 */
function transformerProgram(sketch: p5, read: () => TransformerFrame) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const { height, width } = sketch;
    paintBoard(sketch);
    const core = {
      bottom: height * 0.62,
      left: width * 0.16,
      right: width * 0.6,
      top: height * 0.1,
    };
    const limb = width * 0.07;
    spotlight(
      sketch,
      { x: (core.left + core.right) / 2, y: (core.top + core.bottom) / 2 },
      width * 0.32,
      {
        color: MATERIAL.coalGlow,
        strength: 0.35 * (1 - frame.efficiency),
      }
    );
    const steel = (x: number, y: number, w: number, h: number) =>
      gradientRect(sketch, { height: h, width: w, x, y }, [
        [0, mix(MATERIAL.galvanizedSteel, getColor("WHITE"), 0.15)],
        [1, mix(MATERIAL.galvanizedSteel, getColor("BLACK"), 0.4)],
      ]);
    steel(core.left, core.top, core.right - core.left, limb);
    steel(core.left, core.bottom - limb, core.right - core.left, limb);
    steel(core.left, core.top, limb, core.bottom - core.top);
    steel(core.right - limb, core.top, limb, core.bottom - core.top);
    const primaryTurns = Math.min(
      MOST_TURNS,
      Math.max(2, Math.round(frame.ratio))
    );
    const secondaryTurns = Math.max(1, Math.round(primaryTurns / frame.ratio));
    const span = {
      bottom: core.bottom - limb * 1.3,
      top: core.top + limb * 1.3,
    };
    paintCoil(sketch, core.left + limb / 2, span, primaryTurns, limb * 1.7);
    paintCoil(
      sketch,
      core.right - limb / 2,
      {
        bottom: (span.top + span.bottom) / 2 + 12,
        top: (span.top + span.bottom) / 2 - 12,
      },
      secondaryTurns,
      limb * 1.7
    );
    wire(
      sketch,
      [
        { x: core.left - limb * 0.4, y: span.top },
        { x: width * 0.05, y: span.top },
      ],
      MATERIAL.hullRed
    );
    wire(
      sketch,
      [
        { x: core.left - limb * 0.4, y: span.bottom },
        { x: width * 0.05, y: span.bottom },
      ],
      MATERIAL.trolleyPaint
    );
    const middle = (span.top + span.bottom) / 2;
    wire(
      sketch,
      [
        { x: core.right + limb * 0.4, y: middle - 10 },
        { x: width * 0.78, y: middle - 10 },
        { x: width * 0.78, y: core.top + height * 0.08 },
      ],
      MATERIAL.hullRed
    );
    wire(
      sketch,
      [
        { x: core.right + limb * 0.4, y: middle + 10 },
        { x: width * 0.9, y: middle + 10 },
        { x: width * 0.9, y: core.top + height * 0.08 },
      ],
      MATERIAL.trolleyPaint
    );
    paintBulb(
      sketch,
      { x: width * 0.84, y: core.top + height * 0.05 },
      Math.min(width, height) * 0.12,
      1
    );
    const most = frame.input;
    const bars = [
      { color: PLOT_COLORS.violet, share: frame.input / most },
      { color: PLOT_COLORS.teal, share: frame.output / most },
      { color: PLOT_COLORS.orange, share: frame.lost / most },
    ];
    const base = height * 0.95;
    const tall = height * 0.22;
    Arr.forEach(bars, (bar, index) => {
      const x = width * (0.18 + index * 0.24);
      sketch.noStroke();
      sketch.fill(fade(getColor("WHITE"), 0.12));
      sketch.rect(x, base - tall, width * 0.14, tall, 4);
      sketch.fill(bar.color);
      sketch.rect(
        x,
        base - tall * bar.share,
        width * 0.14,
        tall * bar.share,
        4
      );
    });
    vignette(sketch, 0.3);
    Arr.forEach(bars, (bar, index) => {
      caption(
        sketch,
        frame.readings[index] ?? "",
        { x: width * (0.25 + index * 0.24), y: base - tall * bar.share - 6 },
        {
          align: "center",
          baseline: "bottom",
          color: fade(getColor("WHITE"), 0.9),
          size: 12,
        }
      );
    });
  };
}

interface TransformerLabProps {
  description: NonNullable<ReactNode>;
  /** The transformer's efficiency, from 0 to 1. */
  efficiency: number;
  labels: {
    input: ReactNode;
    lost: ReactNode;
    primaryCurrent: ReactNode;
    ratio: ReactNode;
    viewLabel: string;
  };
  /** The power the load draws from the secondary, in watts. */
  outputPower: number;
  /** The primary voltage, in volts. */
  primaryVoltage: number;
  /** The secondary voltage, in volts. */
  secondaryVoltage: number;
  title: NonNullable<ReactNode>;
}

/**
 * A transformer on a laminated iron core lights a bulb from its secondary
 * coil. Its turns stand in the ratio of its voltages, and since it is not
 * ideal, the core and coils turn part of the input power into heat, so the
 * primary must take in more power than the bulb uses.
 */
export function TransformerLab({
  description,
  efficiency,
  labels,
  outputPower,
  primaryVoltage,
  secondaryVoltage,
  title,
}: TransformerLabProps) {
  const quantity = useQuantity();
  const reading = useReading();
  const coils = transformer({
    efficiency,
    output: outputPower,
    primary: primaryVoltage,
    secondary: secondaryVoltage,
  });

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={transformerProgram}
          state={{
            efficiency,
            input: coils.input,
            lost: coils.lost,
            output: outputPower,
            ratio: coils.ratio,
            readings: Arr.map(
              [coils.input, outputPower, coils.lost],
              (power) => `${reading(power, 1)} W`
            ),
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.ratio}
            value={<InlineMath math={`${quantity(coils.ratio, "", 1)}:1`} />}
          />
          <VisualFactTabular
            label={labels.input}
            value={<InlineMath math={quantity(coils.input, "\\text{ W}", 1)} />}
          />
          <VisualFactTabular
            label={labels.lost}
            value={<InlineMath math={quantity(coils.lost, "\\text{ W}", 1)} />}
          />
          <VisualFactTabular
            label={labels.primaryCurrent}
            value={
              <InlineMath
                math={quantity(coils.primaryCurrent, "\\text{ A}", 3)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
