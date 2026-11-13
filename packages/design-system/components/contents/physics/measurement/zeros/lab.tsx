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
  paintTicks,
  steelStops,
} from "@repo/design-system/components/contents/physics/measurement/scale";
import {
  ROD_LENGTH,
  ROD_TOOLS,
  RodToolSchema,
  RodUnitSchema,
  rodReading,
} from "@repo/design-system/components/contents/physics/measurement/zeros/rod";
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How much bench the overview shows, in centimetres. */
const BENCH_CENTIMETRES = 34;

/** How much scale the magnifier shows for each instrument, in centimetres. */
const LENS_WINDOW = { caliper: 0.5, ruler: 1.4, tape: 7 } as const;

/** What the sketch reads on every frame: the instrument laid along the rod. */
const RodFrame = Schema.Struct({ tool: RodToolSchema });

/** The bench, lit from the upper left. */
function paintBench(sketch: p5) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(getColor("STONE", 600), getColor("WHITE"), 0.15)],
    [0.5, getColor("STONE", 600)],
    [1, mix(getColor("STONE", 600), getColor("BLACK"), 0.55)],
  ]);
  spotlight(sketch, { x: width * 0.3, y: height * 0.15 }, width * 0.7, {
    color: mix(getColor("STONE", 600), getColor("WHITE"), 0.8),
    strength: 0.25,
  });
}

/** The face of an instrument: yellow tape, a steel rule, or a caliper beam. */
function toolStops(tool: typeof RodToolSchema.Type) {
  return tool === "tape"
    ? ([
        [0, mix(PLOT_COLORS.amber, getColor("WHITE"), 0.45)],
        [0.5, PLOT_COLORS.amber],
        [1, mix(PLOT_COLORS.amber, getColor("BLACK"), 0.35)],
      ] as const)
    : steelStops(tool === "caliper" ? 0.2 : 0);
}

/** How long the mark at `index` is, in parts of the strip, for marks one `step` apart. */
function markLength(index: number, step: number) {
  const value = Math.round(index * step * 100);
  return value % 100 === 0 ? 0.6 : value % 50 === 0 ? 0.45 : 0.3;
}

/** A steel rod lying along the scale, from `left` to `right`, centred on `y`. */
function paintRod(sketch: p5, left: number, right: number, y: number, thick: number) {
  withShadow(sketch, { blur: 12, color: fade(getColor("BLACK"), 0.55), drop: 6 }, () => {
    gradientRect(sketch, { height: thick, width: right - left, x: left, y: y - thick / 2 }, steelStops(0.35));
  });
}

/** The rod over the whole instrument, and the frame of the magnifier on its end. */
function paintOverview(sketch: p5, tool: typeof RodToolSchema.Type) {
  const { height, width } = sketch;
  const left = width * 0.07;
  const centimetre = (width * 0.86) / BENCH_CENTIMETRES;
  const top = height * 0.2;
  const strip = height * 0.08;
  withShadow(sketch, { blur: 14, color: fade(getColor("BLACK"), 0.5), drop: 6 }, () => {
    gradientRect(sketch, { height: strip, width: width * 0.9, x: left - width * 0.02, y: top }, toolStops(tool));
  });
  const step = Math.min(ROD_TOOLS[tool], 0.5) * (tool === "caliper" ? 2 : 1);
  paintTicks(sketch, {
    color: fade(getColor("ZINC", 900), 0.8),
    count: Math.round(BENCH_CENTIMETRES / step) + 1,
    direction: 1,
    length: (index) => strip * markLength(index, step),
    start: left,
    step: centimetre * step,
    weight: 1,
    y: top,
  });
  const end = left + ROD_LENGTH * centimetre;
  paintRod(sketch, left, end, top - height * 0.035, height * 0.05);
  sketch.noFill();
  sketch.stroke(fade(PLOT_COLORS.fuchsia, 0.85));
  sketch.strokeWeight(1.5);
  sketch.circle(end, top + strip * 0.2, height * 0.16);
  sketch.line(end, top + strip * 0.2 + height * 0.08, width / 2, height * 0.43);
  sketch.noStroke();
}

/** The magnifier on the rod's end: the instrument's marks at its own resolution. */
function paintLens(sketch: p5, tool: typeof RodToolSchema.Type) {
  const { height, width } = sketch;
  const radius = Math.min(width, height) * 0.27;
  const center = { x: width / 2, y: height * 0.69 };
  const scale = (radius * 2) / LENS_WINDOW[tool];
  const toX = (centimetre: number) => center.x + (centimetre - ROD_LENGTH) * scale;
  withShadow(sketch, { blur: 30, color: fade(getColor("BLACK"), 0.75), drop: 12 }, () => {
    sketch.fill(getColor("ZINC", 900));
    sketch.circle(center.x, center.y, radius * 2 + 16);
  });
  const drawing = sketch.drawingContext;
  sketch.push();
  if (drawing instanceof CanvasRenderingContext2D) {
    drawing.beginPath();
    drawing.arc(center.x, center.y, radius, 0, Math.PI * 2);
    drawing.clip();
  }
  gradientRect(sketch, { height: radius * 2, width: radius * 2, x: center.x - radius, y: center.y - radius }, [
    [0, mix(getColor("STONE", 600), getColor("WHITE"), 0.2)],
    [1, mix(getColor("STONE", 600), getColor("BLACK"), 0.3)],
  ]);
  const top = center.y - radius * 0.05;
  const strip = radius * 0.55;
  gradientRect(sketch, { height: strip, width: radius * 2, x: center.x - radius, y: top }, toolStops(tool));
  const mainStep = tool === "tape" ? 1 : 0.1;
  const first = Math.ceil((ROD_LENGTH - LENS_WINDOW[tool] / 2) / mainStep) * mainStep;
  paintTicks(sketch, {
    color: getColor("ZINC", 900),
    count: Math.round(LENS_WINDOW[tool] / mainStep) + 1,
    direction: 1,
    length: (index) => strip * markLength(Math.round(first / mainStep) + index, mainStep) * (tool === "caliper" ? 0.6 : 1),
    start: toX(first),
    step: scale * mainStep,
    weight: 3,
    y: top,
  });
  if (tool === "caliper") {
    gradientRect(sketch, { height: strip * 0.45, width: radius * 2, x: toX(ROD_LENGTH) - 4, y: top + strip * 0.55 }, steelStops(0.4));
    paintTicks(sketch, {
      color: getColor("ZINC", 900),
      count: 11,
      direction: 1,
      length: (index) => strip * (index % 5 === 0 ? 0.3 : 0.2),
      start: toX(ROD_LENGTH),
      step: scale * 0.09,
      weight: 3,
      y: top + strip * 0.55,
    });
  }
  paintRod(sketch, center.x - radius * 1.2, toX(ROD_LENGTH), top - radius * 0.22, radius * 0.32);
  const reading = rodReading(tool, "cm").value;
  sketch.stroke(PLOT_COLORS.fuchsia);
  sketch.strokeWeight(4);
  sketch.line(toX(reading), top - radius * 0.45, toX(reading), top + strip * (tool === "caliper" ? 0.55 : 0.75));
  sketch.noStroke();
  sketch.pop();
  sketch.noFill();
  sketch.stroke(fade(getColor("WHITE"), 0.35));
  sketch.strokeWeight(3);
  sketch.arc(center.x, center.y, radius * 2 - 6, radius * 2 - 6, Math.PI * 1.05, Math.PI * 1.45);
  sketch.noStroke();
}

/** Draws the rod on its instrument and the magnifier on its end. */
function rodProgram(sketch: p5, read: () => typeof RodFrame.Type) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { tool } = read();
    paintBench(sketch);
    paintOverview(sketch, tool);
    paintLens(sketch, tool);
    vignette(sketch, 0.35);
  };
}

interface SignificantZerosLabProps {
  description: ReactNode;
  labels: {
    chooseTool: string;
    chooseUnit: string;
    figures: ReactNode;
    measuredZeros: ReactNode;
    placeZeros: ReactNode;
    reading: ReactNode;
    scientific: ReactNode;
    tools: Record<typeof RodToolSchema.Type, ReactNode>;
    viewLabel: string;
  };
  title: ReactNode;
}

/** The unit symbol of a reading, as KaTeX. */
const UNIT_TEXT = { cm: "\\text{ cm}", m: "\\text{ m}", mm: "\\text{ mm}" } as const;

/**
 * One steel rod read with a tape measure, a steel ruler and a long vernier
 * caliper, and written in millimetres, centimetres or metres. A finer
 * instrument adds a measured zero; a change of unit only adds zeros that
 * hold place value, and the significant figures stay.
 */
export function SignificantZerosLab({ description, labels, title }: SignificantZerosLabProps) {
  const [tool, setTool] = useState<typeof RodToolSchema.Type>("ruler");
  const [unit, setUnit] = useState<typeof RodUnitSchema.Type>("cm");
  const fixed = useFixed();
  const reading = rodReading(tool, unit);
  const { coefficient, exponent } = scientific(reading.value, reading.figures);
  const isTool = Schema.is(RodToolSchema);
  const isUnit = Schema.is(RodUnitSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseTool}
          gridColumns="3"
          onValueChange={(value) => {
            if (isTool(value)) {
              setTool(value);
            }
          }}
          type="single"
          value={tool}
          variant="outline"
        >
          {Arr.map(RodToolSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.tools[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          aria-label={labels.chooseUnit}
          gridColumns="3"
          onValueChange={(value) => {
            if (isUnit(value)) {
              setUnit(value);
            }
          }}
          type="single"
          value={unit}
          variant="outline"
        >
          {Arr.map(RodUnitSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              <InlineMath math={UNIT_TEXT[option]} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch label={labels.viewLabel} program={rodProgram} state={{ tool }} />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular label={labels.reading} value={<InlineMath math={fixed(reading.value, UNIT_TEXT[unit], reading.decimals)} />} />
          <VisualFactTabular label={labels.figures} value={<InlineMath math={`${reading.figures}`} />} />
          <VisualFactTabular label={labels.measuredZeros} value={<InlineMath math={`${reading.measuredZeros}`} />} />
          <VisualFactTabular label={labels.placeZeros} value={<InlineMath math={`${reading.placeZeros}`} />} />
          <VisualFactTabular
            label={labels.scientific}
            value={<InlineMath math={`${fixed(coefficient, "", reading.figures - 1)}\\times10^{${exponent}}${UNIT_TEXT[unit]}`} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
