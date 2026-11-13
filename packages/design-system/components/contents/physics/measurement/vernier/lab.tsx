import {
  fade,
  gradientRect,
  litBall,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import {
  brassStops,
  paintTicks,
  steelStops,
  tier,
} from "@repo/design-system/components/contents/physics/measurement/scale";
import {
  CALIPER_RANGE,
  VERNIER_DIVISIONS,
  VERNIER_RESOLUTION,
  vernierMark,
  vernierReading,
} from "@repo/design-system/components/contents/physics/measurement/vernier/caliper";
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

/** How much of the main scale the whole caliper shows, in millimetres. */
const BEAM_MILLIMETRES = 62;

/** How much of the main scale the magnifier shows, in millimetres. */
const LENS_MILLIMETRES = 13;

/** How quickly the jaw slides to a new width, per second. */
const SLIDE_RATE = 7;

/** What the sketch reads on every frame: the width of the object between the jaws. */
const CaliperFrame = Schema.Struct({ width: Schema.Number });

/** Positions of the caliper and the magnifier for one canvas size. */
function layout(sketch: p5) {
  const { height, width } = sketch;
  return {
    beamHeight: height * 0.075,
    beamTop: height * 0.14,
    jawBottom: height * 0.47,
    lensBottom: height * 0.95,
    lensTop: height * 0.57,
    millimetre: (width * 0.8) / BEAM_MILLIMETRES,
    zero: width * 0.12,
  };
}

/** The bench under a desk lamp, out of focus behind the caliper. */
function paintBench(sketch: p5) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(getColor("STONE", 600), getColor("NEUTRAL", 800), 0.55)],
    [0.6, getColor("NEUTRAL", 800)],
    [1, mix(getColor("NEUTRAL", 800), getColor("BLACK"), 0.45)],
  ]);
  spotlight(sketch, { x: width * 0.4, y: height * 0.25 }, width * 0.6, {
    color: mix(getColor("STONE", 600), getColor("WHITE"), 0.75),
    strength: 0.24,
  });
}

/** The beam, both jaws, and the brass cylinder they hold, at jaw opening `opening`. */
function paintCaliper(
  sketch: p5,
  place: ReturnType<typeof layout>,
  opening: number
) {
  const { width } = sketch;
  const face = place.zero + opening * place.millimetre;
  const jawWidth = width * 0.035;
  const shadow = { blur: 16, color: fade(getColor("BLACK"), 0.6), drop: 7 };
  const top = place.beamTop + place.beamHeight * 1.6;
  const tall = place.jawBottom - top - sketch.height * 0.01;
  withShadow(sketch, shadow, () => {
    gradientRect(
      sketch,
      { height: tall, width: face - place.zero, x: place.zero, y: top },
      brassStops(PLOT_COLORS.amber),
      true
    );
  });
  sketch.fill(fade(getColor("WHITE"), 0.25));
  sketch.ellipse(
    (place.zero + face) / 2,
    top,
    face - place.zero,
    sketch.height * 0.018
  );
  withShadow(sketch, shadow, () => {
    gradientRect(
      sketch,
      {
        height: place.beamHeight,
        width: width * 0.96 - place.zero + jawWidth,
        x: place.zero - jawWidth,
        y: place.beamTop,
      },
      steelStops()
    );
    gradientRect(
      sketch,
      {
        height: place.jawBottom - place.beamTop,
        width: jawWidth,
        x: place.zero - jawWidth,
        y: place.beamTop,
      },
      steelStops(0.15),
      true
    );
    gradientRect(
      sketch,
      {
        height: place.jawBottom - place.beamTop,
        width: jawWidth,
        x: face,
        y: place.beamTop,
      },
      steelStops(0.15),
      true
    );
    gradientRect(
      sketch,
      {
        height: place.beamHeight * 1.5,
        width: width * 0.16,
        x: face,
        y: place.beamTop + place.beamHeight * 0.55,
      },
      steelStops(0.3)
    );
  });
  litBall(
    sketch,
    { x: face + width * 0.11, y: place.beamTop - place.beamHeight * 0.15 },
    place.beamHeight * 0.32,
    {
      dark: getColor("SLATE", 600),
      light: getColor("SLATE", 50),
    }
  );
  paintTicks(sketch, {
    color: fade(getColor("ZINC", 900), 0.85),
    count: VERNIER_DIVISIONS + 1,
    direction: 1,
    length: (index) => place.beamHeight * (index % 5 === 0 ? 0.5 : 0.32),
    start: face,
    step: place.millimetre * (vernierMark(0, 1) - vernierMark(0, 0)),
    weight: 1,
    y: place.beamTop + place.beamHeight * 0.55,
  });
  paintTicks(sketch, {
    color: fade(getColor("ZINC", 900), 0.85),
    count: BEAM_MILLIMETRES + 1,
    direction: -1,
    length: (index) =>
      place.beamHeight * tier(index, [10, 5], [0.6, 0.45, 0.3]),
    start: place.zero,
    step: place.millimetre,
    weight: 1,
    y: place.beamTop + place.beamHeight,
  });
  sketch.noFill();
  sketch.stroke(fade(PLOT_COLORS.fuchsia, 0.85));
  sketch.strokeWeight(1.5);
  sketch.rect(
    face - place.millimetre * 1.5,
    place.beamTop - 2,
    place.millimetre * LENS_MILLIMETRES,
    place.beamHeight * 2.2,
    4
  );
  sketch.line(
    face - place.millimetre * 1.5,
    place.beamTop + place.beamHeight * 2.2,
    sketch.width * 0.04,
    place.lensTop
  );
  sketch.line(
    face + place.millimetre * (LENS_MILLIMETRES - 1.5),
    place.beamTop + place.beamHeight * 2.2,
    sketch.width * 0.96,
    place.lensTop
  );
  sketch.noStroke();
}

/**
 * The magnifier: the main scale over the vernier around the vernier zero,
 * with the one pair of lines that meet in fuchsia.
 */
function paintLens(
  sketch: p5,
  place: ReturnType<typeof layout>,
  opening: number
) {
  const { width } = sketch;
  const left = width * 0.04;
  const lensWidth = width * 0.92;
  const lensHeight = place.lensBottom - place.lensTop;
  const scale = lensWidth / LENS_MILLIMETRES;
  const from = opening - 1.5;
  const toX = (millimetre: number) => left + (millimetre - from) * scale;
  withShadow(
    sketch,
    { blur: 22, color: fade(getColor("BLACK"), 0.7), drop: 8 },
    () => {
      sketch.fill(getColor("ZINC", 900));
      sketch.rect(left, place.lensTop, lensWidth, lensHeight, 14);
    }
  );
  const edge = place.lensTop + lensHeight * 0.48;
  gradientRect(
    sketch,
    {
      height: edge - place.lensTop - lensHeight * 0.08,
      width: lensWidth,
      x: left,
      y: place.lensTop + lensHeight * 0.08,
    },
    steelStops()
  );
  gradientRect(
    sketch,
    {
      height: lensHeight * 0.36,
      width: lensWidth - (toX(opening) - left) + scale * 0.6,
      x: toX(opening) - scale * 0.6,
      y: edge + 2,
    },
    steelStops(0.3)
  );
  const first = Math.ceil(from);
  const { line } = vernierReading(opening);
  const met = vernierMark(opening, line);
  paintTicks(sketch, {
    color: getColor("ZINC", 900),
    count: LENS_MILLIMETRES + 1,
    direction: -1,
    length: (index) =>
      lensHeight * tier(first + index, [10, 5], [0.3, 0.22, 0.15]),
    start: toX(first),
    step: scale,
    weight: 2,
    y: edge,
  });
  paintTicks(sketch, {
    color: getColor("ZINC", 900),
    count: VERNIER_DIVISIONS + 1,
    direction: 1,
    length: (index) => lensHeight * (index % 5 === 0 ? 0.24 : 0.16),
    start: toX(opening),
    step: scale * (vernierMark(0, 1) - vernierMark(0, 0)),
    weight: 2,
    y: edge + 2,
  });
  sketch.stroke(PLOT_COLORS.fuchsia);
  sketch.strokeWeight(3.5);
  sketch.line(
    toX(met),
    edge - lensHeight * 0.17,
    toX(met),
    edge + lensHeight * 0.2
  );
  sketch.stroke(PLOT_COLORS.teal);
  sketch.line(toX(opening), edge + 2, toX(opening), edge + lensHeight * 0.28);
  sketch.noStroke();
  gradientRect(
    sketch,
    { height: lensHeight * 0.18, width: lensWidth, x: left, y: place.lensTop },
    [
      [0, fade(getColor("WHITE"), 0.12)],
      [1, fade(getColor("WHITE"), 0)],
    ]
  );
}

/** Draws one moment: the jaw slides to the object, and the magnifier follows its vernier zero. */
function caliperProgram(sketch: p5, read: () => typeof CaliperFrame.Type) {
  let opening = read().width;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { width } = read();
    const step = Math.min(sketch.deltaTime / 1000, 0.1) * SLIDE_RATE;
    opening = sketch.isLooping()
      ? opening + (width - opening) * Math.min(step, 1)
      : width;
    const place = layout(sketch);
    paintBench(sketch);
    paintCaliper(sketch, place, opening);
    paintLens(sketch, place, opening);
    vignette(sketch, 0.4);
  };
}

interface VernierCaliperLabProps {
  description: ReactNode;
  labels: {
    centimetres: ReactNode;
    line: ReactNode;
    main: ReactNode;
    reading: ReactNode;
    viewLabel: string;
    width: string;
  };
  title: ReactNode;
  /** The width of the object the caliper first holds, in millimetres. */
  width?: number;
}

/**
 * A vernier caliper closed on a brass cylinder, with a magnifier on its
 * scales. Slide the jaw: the vernier zero gives the whole millimetres, and the
 * one vernier line that meets a main mark gives the tenth.
 */
export function VernierCaliperLab({
  description,
  labels,
  title,
  width: initialWidth = 18.4,
}: VernierCaliperLabProps) {
  const [width, setWidth] = useState(initialWidth);
  const fixed = useFixed();
  const { line, main, reading } = vernierReading(width);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.width}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={measure(reading, "\\text{ mm}", 1)} />
            </span>
          </div>
          <Slider
            aria-label={labels.width}
            max={CALIPER_RANGE.max}
            min={CALIPER_RANGE.min}
            onValueChange={setWidth}
            step={VERNIER_RESOLUTION}
            value={width}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={caliperProgram}
          state={{ width: reading }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.main}
            value={<InlineMath math={measure(main, "\\text{ mm}", 0)} />}
          />
          <VisualFactTabular
            label={labels.line}
            value={<InlineMath math={`${line}`} />}
          />
          <VisualFactTabular
            label={labels.reading}
            value={
              <InlineMath
                math={`${main}+${line}\\times${measure(VERNIER_RESOLUTION, "", 1)}=${measure(reading, "\\text{ mm}", 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.centimetres}
            value={
              <InlineMath math={measure(reading / 10, "\\text{ cm}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
