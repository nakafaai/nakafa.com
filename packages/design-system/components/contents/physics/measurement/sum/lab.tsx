import {
  fade,
  gradientRect,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import {
  paintTicks,
  steelStops,
  tier,
} from "@repo/design-system/components/contents/physics/measurement/scale";
import {
  COPPER_LENGTH,
  CopperToolSchema,
  IRON_LENGTH,
  joinedRods,
} from "@repo/design-system/components/contents/physics/measurement/sum/rods";
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

/** How much ruler the overview shows, in centimetres. */
const RULER_CENTIMETRES = 15;

/** The stretch of ruler the magnifier shows around the joined end, in centimetres. */
const LENS_FROM = 12.55;
const LENS_TO = 12.95;

/** What the sketch reads on every frame: the instrument the copper rod was read with. */
const SumFrame = Schema.Struct({ tool: CopperToolSchema });

/** The gradient of a copper rod lit from above. */
function copperStops() {
  const copper = mix(PLOT_COLORS.orange, PLOT_COLORS.pink, 0.2);
  return [
    [0, mix(copper, getColor("WHITE"), 0.5)],
    [0.25, copper],
    [1, mix(copper, getColor("BLACK"), 0.55)],
  ] as const;
}

/** The bench, both rods end to end, and the ruler under them. */
function paintBench(sketch: p5) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(getColor("SLATE", 600), getColor("WHITE"), 0.1)],
    [0.55, getColor("SLATE", 700)],
    [1, mix(getColor("SLATE", 800), getColor("BLACK"), 0.4)],
  ]);
  spotlight(sketch, { x: width * 0.45, y: height * 0.2 }, width * 0.7, {
    color: mix(getColor("SLATE", 200), getColor("WHITE"), 0.6),
    strength: 0.22,
  });
  const left = width * 0.06;
  const centimetre = (width * 0.88) / RULER_CENTIMETRES;
  const top = height * 0.26;
  const strip = height * 0.08;
  withShadow(
    sketch,
    { blur: 14, color: fade(getColor("BLACK"), 0.5), drop: 6 },
    () => {
      gradientRect(
        sketch,
        { height: strip, width: width * 0.91, x: left - width * 0.015, y: top },
        steelStops()
      );
    }
  );
  paintTicks(sketch, {
    color: fade(getColor("ZINC", 900), 0.8),
    count: RULER_CENTIMETRES * 10 + 1,
    direction: 1,
    length: (index) => strip * tier(index, [10, 5], [0.6, 0.42, 0.26]),
    start: left,
    step: centimetre / 10,
    weight: 1,
    y: top,
  });
  const thick = height * 0.06;
  const joint = left + IRON_LENGTH * centimetre;
  const end = joint + COPPER_LENGTH * centimetre;
  withShadow(
    sketch,
    { blur: 12, color: fade(getColor("BLACK"), 0.55), drop: 6 },
    () => {
      gradientRect(
        sketch,
        { height: thick, width: joint - left, x: left, y: top - thick * 1.1 },
        steelStops(0.55)
      );
      gradientRect(
        sketch,
        { height: thick, width: end - joint, x: joint, y: top - thick * 1.1 },
        copperStops()
      );
    }
  );
  sketch.noFill();
  sketch.stroke(fade(PLOT_COLORS.fuchsia, 0.85));
  sketch.strokeWeight(1.5);
  const lensLeft = left + LENS_FROM * centimetre;
  const lensRight = left + LENS_TO * centimetre;
  sketch.rect(
    lensLeft,
    top - thick * 1.3,
    lensRight - lensLeft,
    thick * 1.3 + strip,
    3
  );
  sketch.line(lensLeft, top + strip, width * 0.04, height * 0.5);
  sketch.line(lensRight, top + strip, width * 0.96, height * 0.5);
  sketch.noStroke();
}

/**
 * The magnifier on the joined end: the ruler's millimetres, the hundredths a
 * calculator writes, the band where the end may really lie, and the rounded sum.
 */
function paintLens(sketch: p5, tool: typeof CopperToolSchema.Type) {
  const { height, width } = sketch;
  const left = width * 0.04;
  const lensWidth = width * 0.92;
  const top = height * 0.5;
  const lensHeight = height * 0.45;
  const scale = lensWidth / (LENS_TO - LENS_FROM);
  const toX = (centimetre: number) => left + (centimetre - LENS_FROM) * scale;
  const rods = joinedRods(tool);
  withShadow(
    sketch,
    { blur: 22, color: fade(getColor("BLACK"), 0.7), drop: 8 },
    () => {
      sketch.fill(getColor("ZINC", 900));
      sketch.rect(left, top, lensWidth, lensHeight, 14);
    }
  );
  const edge = top + lensHeight * 0.55;
  gradientRect(
    sketch,
    { height: lensHeight * 0.4, width: lensWidth, x: left, y: edge },
    steelStops()
  );
  paintTicks(sketch, {
    color: fade(getColor("ZINC", 900), 0.35),
    count: Math.round((LENS_TO - LENS_FROM) * 100) + 1,
    direction: 1,
    length: () => lensHeight * 0.06,
    start: toX(LENS_FROM),
    step: scale / 100,
    weight: 1,
    y: edge,
  });
  paintTicks(sketch, {
    color: getColor("ZINC", 900),
    count: 5,
    direction: 1,
    length: (index) => lensHeight * (index === 0 || index === 4 ? 0.2 : 0.14),
    start: toX(12.6),
    step: scale / 10,
    weight: 3,
    y: edge,
  });
  const thick = lensHeight * 0.26;
  withShadow(
    sketch,
    { blur: 16, color: fade(getColor("BLACK"), 0.6), drop: 8 },
    () => {
      gradientRect(
        sketch,
        {
          height: thick,
          width: toX(IRON_LENGTH + COPPER_LENGTH) - left,
          x: left,
          y: edge - thick - lensHeight * 0.04,
        },
        copperStops()
      );
    }
  );
  sketch.fill(fade(PLOT_COLORS.teal, 0.35));
  const bandLeft = toX(rods.raw - rods.spread);
  sketch.rect(
    bandLeft,
    top + lensHeight * 0.06,
    toX(rods.raw + rods.spread) - bandLeft,
    lensHeight * 0.88
  );
  sketch.stroke(PLOT_COLORS.violet);
  sketch.strokeWeight(2);
  sketch.line(
    toX(rods.raw),
    top + lensHeight * 0.06,
    toX(rods.raw),
    top + lensHeight * 0.94
  );
  sketch.stroke(PLOT_COLORS.fuchsia);
  sketch.strokeWeight(4);
  sketch.line(
    toX(rods.reported),
    edge - lensHeight * 0.05,
    toX(rods.reported),
    edge + lensHeight * 0.28
  );
  sketch.noStroke();
}

/** Draws the joined rods and the magnifier on their end. */
function sumProgram(sketch: p5, read: () => typeof SumFrame.Type) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    paintBench(sketch);
    paintLens(sketch, read().tool);
    vignette(sketch, 0.35);
  };
}

interface DecimalSumLabProps {
  description: ReactNode;
  labels: {
    chooseTool: string;
    copper: ReactNode;
    iron: ReactNode;
    raw: ReactNode;
    reported: ReactNode;
    tools: Record<typeof CopperToolSchema.Type, ReactNode>;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * An iron rod read with a caliper joined to a copper rod read with a ruler
 * or the caliper. The magnifier shows the band where the joined end may lie:
 * a ruler reading widens it past every hundredth, so the sum keeps one decimal.
 */
export function DecimalSumLab({
  description,
  labels,
  title,
}: DecimalSumLabProps) {
  const [tool, setTool] = useState<typeof CopperToolSchema.Type>("ruler");
  const fixed = useFixed();
  const rods = joinedRods(tool);
  const isTool = Schema.is(CopperToolSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseTool}
          gridColumns="2"
          onValueChange={(value) => {
            if (isTool(value)) {
              setTool(value);
            }
          }}
          type="single"
          value={tool}
          variant="outline"
        >
          {Arr.map(CopperToolSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.tools[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={sumProgram}
          state={{ tool }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.iron}
            value={
              <InlineMath
                math={fixed(rods.iron, "\\text{ cm}", rods.ironDecimals)}
              />
            }
          />
          <VisualFactTabular
            label={labels.copper}
            value={
              <InlineMath
                math={fixed(rods.copper, "\\text{ cm}", rods.copperDecimals)}
              />
            }
          />
          <VisualFactTabular
            label={labels.raw}
            value={
              <InlineMath
                math={fixed(rods.raw, "\\text{ cm}", rods.ironDecimals)}
              />
            }
          />
          <VisualFactTabular
            label={labels.reported}
            value={
              <InlineMath
                math={fixed(rods.reported, "\\text{ cm}", rods.decimals)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
