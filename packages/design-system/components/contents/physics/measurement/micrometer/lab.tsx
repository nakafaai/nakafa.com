import { useMeasure } from "@repo/design-system/components/contents/physics/canvas/measure";
import {
  fade,
  gradientRect,
  litBall,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  micrometerReading,
  SCREW_RANGE,
  SCREW_RESOLUTION,
  THIMBLE_DIVISIONS,
  thimbleTurn,
} from "@repo/design-system/components/contents/physics/measurement/micrometer/screw";
import {
  paintTicks,
  steelStops,
} from "@repo/design-system/components/contents/physics/measurement/scale";
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How many millimetres of sleeve the magnifier shows left of the thimble. */
const LENS_SLEEVE = 5.5;

/** How quickly the spindle closes on a new size, per second. */
const TURN_RATE = 6;

/** What the sketch reads on every frame: the size of the ball between anvil and spindle. */
const GaugeFrame = Schema.Struct({ thickness: Schema.Number });

/** Positions of the gauge and the magnifier for one canvas size. */
function layout(sketch: p5) {
  const { height, width } = sketch;
  return {
    anvil: width * 0.2,
    axis: height * 0.2,
    lensBottom: height * 0.95,
    lensTop: height * 0.56,
    millimetre: width * 0.013,
    sleeve: width * 0.44,
  };
}

/** The dark bench under a lamp, behind the gauge. */
function paintBench(sketch: p5) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(getColor("SLATE", 700), getColor("NEUTRAL", 800), 0.4)],
    [0.6, getColor("NEUTRAL", 800)],
    [1, mix(getColor("NEUTRAL", 800), getColor("BLACK"), 0.5)],
  ]);
  spotlight(sketch, { x: width * 0.35, y: height * 0.2 }, width * 0.6, {
    color: mix(getColor("SLATE", 200), getColor("WHITE"), 0.5),
    strength: 0.22,
  });
}

/** The C frame, anvil, ball, spindle, sleeve and thimble, closed to `travel` millimetres. */
function paintGauge(
  sketch: p5,
  place: ReturnType<typeof layout>,
  travel: number
) {
  const { height, width } = sketch;
  const rod = height * 0.035;
  const face = place.anvil + travel * place.millimetre;
  const frame = mix(getColor("SLATE", 700), PLOT_COLORS.slate, 0.3);
  withShadow(
    sketch,
    { blur: 20, color: fade(getColor("BLACK"), 0.65), drop: 9 },
    () => {
      sketch.noFill();
      sketch.stroke(frame);
      sketch.strokeWeight(height * 0.07);
      sketch.strokeJoin(sketch.ROUND);
      sketch.beginShape();
      sketch.vertex(place.anvil - width * 0.05, place.axis);
      sketch.vertex(place.anvil - width * 0.05, height * 0.43);
      sketch.vertex(place.sleeve - width * 0.03, height * 0.43);
      sketch.vertex(place.sleeve - width * 0.03, place.axis);
      sketch.endShape();
      sketch.stroke(fade(getColor("WHITE"), 0.18));
      sketch.strokeWeight(height * 0.012);
      sketch.line(
        place.anvil - width * 0.065,
        place.axis,
        place.anvil - width * 0.065,
        height * 0.42
      );
      sketch.noStroke();
    }
  );
  const ball = (travel * place.millimetre) / 2;
  withShadow(
    sketch,
    { blur: 12, color: fade(getColor("BLACK"), 0.6), drop: 5 },
    () => {
      litBall(sketch, { x: place.anvil + ball, y: place.axis }, ball, {
        dark: getColor("SLATE", 600),
        light: getColor("SLATE", 50),
      });
    }
  );
  gradientRect(
    sketch,
    {
      height: rod,
      width: width * 0.04,
      x: place.anvil - width * 0.04,
      y: place.axis - rod / 2,
    },
    steelStops()
  );
  gradientRect(
    sketch,
    {
      height: rod,
      width: place.sleeve - face,
      x: face,
      y: place.axis - rod / 2,
    },
    steelStops()
  );
  const sleeveHeight = height * 0.06;
  gradientRect(
    sketch,
    {
      height: sleeveHeight,
      width: width * 0.24,
      x: place.sleeve,
      y: place.axis - sleeveHeight / 2,
    },
    steelStops(0.1)
  );
  paintTicks(sketch, {
    color: fade(getColor("ZINC", 900), 0.8),
    count: 13,
    direction: -1,
    length: () => sleeveHeight * 0.3,
    start: place.sleeve + width * 0.01,
    step: place.millimetre,
    weight: 1,
    y: place.axis,
  });
  const thimbleHeight = height * 0.09;
  const edge = place.sleeve + width * 0.01 + travel * place.millimetre;
  withShadow(
    sketch,
    { blur: 10, color: fade(getColor("BLACK"), 0.5), drop: 4 },
    () => {
      gradientRect(
        sketch,
        {
          height: thimbleHeight,
          width: width * 0.17,
          x: edge,
          y: place.axis - thimbleHeight / 2,
        },
        steelStops(0.25)
      );
      gradientRect(
        sketch,
        {
          height: thimbleHeight * 0.7,
          width: width * 0.05,
          x: edge + width * 0.17,
          y: place.axis - thimbleHeight * 0.35,
        },
        steelStops(0.5)
      );
    }
  );
  for (let knurl = 0; knurl < 9; knurl += 1) {
    sketch.stroke(fade(getColor("ZINC", 900), 0.35));
    sketch.strokeWeight(1);
    const x = edge + width * 0.08 + knurl * width * 0.009;
    sketch.line(
      x,
      place.axis - thimbleHeight / 2,
      x,
      place.axis + thimbleHeight / 2
    );
  }
  sketch.noFill();
  sketch.stroke(fade(PLOT_COLORS.fuchsia, 0.85));
  sketch.strokeWeight(1.5);
  sketch.rect(
    edge - width * 0.07,
    place.axis - thimbleHeight * 0.7,
    width * 0.1,
    thimbleHeight * 1.4,
    4
  );
  sketch.line(
    edge - width * 0.07,
    place.axis + thimbleHeight * 0.7,
    width * 0.04,
    place.lensTop
  );
  sketch.line(
    edge + width * 0.03,
    place.axis + thimbleHeight * 0.7,
    width * 0.96,
    place.lensTop
  );
  sketch.noStroke();
}

/**
 * The magnifier: whole and half millimetres on the sleeve around its datum
 * line, and the thimble rim whose divisions wrap round the screw.
 */
function paintLens(
  sketch: p5,
  place: ReturnType<typeof layout>,
  travel: number
) {
  const { width } = sketch;
  const left = width * 0.04;
  const lensWidth = width * 0.92;
  const lensHeight = place.lensBottom - place.lensTop;
  const scale = (lensWidth * 0.62) / LENS_SLEEVE;
  const edge = left + lensWidth * 0.62;
  const datum = place.lensTop + lensHeight * 0.5;
  const toX = (millimetre: number) => edge - (travel - millimetre) * scale;
  withShadow(
    sketch,
    { blur: 22, color: fade(getColor("BLACK"), 0.7), drop: 8 },
    () => {
      sketch.fill(getColor("ZINC", 900));
      sketch.rect(left, place.lensTop, lensWidth, lensHeight, 14);
    }
  );
  const sleeveHalf = lensHeight * 0.24;
  gradientRect(
    sketch,
    {
      height: sleeveHalf * 2,
      width: edge - left,
      x: left,
      y: datum - sleeveHalf,
    },
    steelStops()
  );
  sketch.stroke(PLOT_COLORS.teal);
  sketch.strokeWeight(2.5);
  sketch.line(left, datum, edge, datum);
  const first = Math.max(Math.ceil(travel - LENS_SLEEVE), 0);
  paintTicks(sketch, {
    color: getColor("ZINC", 900),
    count: Math.floor(travel) - first + 1,
    direction: -1,
    length: (index) => sleeveHalf * ((first + index) % 5 === 0 ? 0.75 : 0.55),
    start: toX(first),
    step: scale,
    weight: 2.5,
    y: datum - 1,
  });
  const firstHalf = Math.max(Math.ceil(travel - LENS_SLEEVE - 0.5), 0) + 0.5;
  paintTicks(sketch, {
    color: getColor("ZINC", 900),
    count: Math.max(Math.floor(travel - firstHalf) + 1, 0),
    direction: 1,
    length: () => sleeveHalf * 0.5,
    start: toX(firstHalf),
    step: scale,
    weight: 2.5,
    y: datum + 1,
  });
  const radius = lensHeight * 0.42;
  withShadow(
    sketch,
    { blur: 14, color: fade(getColor("BLACK"), 0.6), drop: 0 },
    () => {
      gradientRect(
        sketch,
        {
          height: radius * 2,
          width: left + lensWidth - edge,
          x: edge,
          y: datum - radius,
        },
        steelStops(0.2)
      );
    }
  );
  const turned = thimbleTurn(travel);
  for (let division = 0; division < THIMBLE_DIVISIONS; division += 1) {
    const angle = ((division - turned) / THIMBLE_DIVISIONS) * Math.PI * 2;
    if (Math.cos(angle) > 0.15) {
      const y = datum - radius * Math.sin(angle);
      const onDatum =
        Math.abs(division - (Math.round(turned) % THIMBLE_DIVISIONS)) === 0;
      sketch.stroke(
        onDatum
          ? PLOT_COLORS.fuchsia
          : fade(getColor("ZINC", 900), 0.4 + 0.6 * Math.cos(angle))
      );
      sketch.strokeWeight(onDatum ? 3.5 : 2);
      sketch.line(
        edge,
        y,
        edge + lensWidth * (division % 5 === 0 ? 0.13 : 0.08),
        y
      );
    }
  }
  sketch.noStroke();
  gradientRect(
    sketch,
    { height: lensHeight * 0.18, width: lensWidth, x: left, y: place.lensTop },
    [
      [0, fade(getColor("WHITE"), 0.1)],
      [1, fade(getColor("WHITE"), 0)],
    ]
  );
}

/** Draws one moment: the thimble turns until the spindle meets the ball. */
function gaugeProgram(sketch: p5, read: () => typeof GaugeFrame.Type) {
  let travel = read().thickness;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { thickness } = read();
    const step = Math.min(sketch.deltaTime / 1000, 0.1) * TURN_RATE;
    travel = sketch.isLooping()
      ? travel + (thickness - travel) * Math.min(step, 1)
      : thickness;
    const place = layout(sketch);
    paintBench(sketch);
    paintGauge(sketch, place, travel);
    paintLens(sketch, place, travel);
    vignette(sketch, 0.4);
  };
}

interface MicrometerScrewLabProps {
  description: ReactNode;
  labels: {
    division: ReactNode;
    reading: ReactNode;
    size: string;
    sleeve: ReactNode;
    viewLabel: string;
  };
  /** The size of the ball the gauge first holds, in millimetres. */
  thickness?: number;
  title: ReactNode;
}

/**
 * A micrometer screw gauge closed on a steel ball, with a magnifier on its
 * sleeve and thimble. The sleeve gives whole and half millimetres; the
 * thimble division on the datum line adds hundredths of a millimetre.
 */
export function MicrometerScrewLab({
  description,
  labels,
  thickness: initialThickness = 6.35,
  title,
}: MicrometerScrewLabProps) {
  const [thickness, setThickness] = useState(initialThickness);
  const measure = useMeasure();
  const { division, reading, sleeve } = micrometerReading(thickness);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.size}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={measure(reading, "\\text{ mm}", 2)} />
            </span>
          </div>
          <Slider
            aria-label={labels.size}
            max={SCREW_RANGE.max}
            min={SCREW_RANGE.min}
            onValueChange={setThickness}
            step={SCREW_RESOLUTION}
            value={thickness}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={gaugeProgram}
          state={{ thickness: reading }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.sleeve}
            value={<InlineMath math={measure(sleeve, "\\text{ mm}", 1)} />}
          />
          <VisualFactTabular
            label={labels.division}
            value={<InlineMath math={`${division}`} />}
          />
          <VisualFactTabular
            label={labels.reading}
            value={
              <InlineMath
                math={`${measure(sleeve, "", 1)}+${division}\\times${measure(SCREW_RESOLUTION, "", 2)}=${measure(reading, "\\text{ mm}", 2)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
