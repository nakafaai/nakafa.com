import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
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
  DESK_LENGTH,
  REFERENCES,
  ReferenceSchema,
  referenceCount,
} from "@repo/design-system/components/contents/physics/measurement/reference/pencils";
import {
  paintTicks,
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How long one reference takes to lay down, in seconds. */
const STEP_SECONDS = 0.55;

/** How long the finished count rests before it starts again, in seconds. */
const HOLD_SECONDS = 1.8;

/** What the sketch reads on every frame: who measures the desk. */
const DeskFrame = Schema.Struct({ reference: ReferenceSchema });

/** The paint of each friend's pencil. */
const PAINT = {
  long: PLOT_COLORS.violet,
  medium: PLOT_COLORS.amber,
  short: PLOT_COLORS.teal,
} as const;

/** A pencil's parts, in millimetres of a 150 mm pencil. */
const PENCIL_SIZES = {
  cone: 20,
  eraser: 7,
  ferrule: 11,
  length: 150,
  thick: 7.5,
} as const;

/** The longest reference the close-up shows whole, in metres. */
const CLOSE_METRES = 0.24;

/** Positions of the desk for one canvas size. */
function layout(sketch: p5) {
  const { height, width } = sketch;
  const left = width * 0.08;
  return {
    edge: height * 0.3,
    left,
    metre: (width * 0.84) / DESK_LENGTH,
    right: width * 0.92,
  };
}

/** The floor and the desk top seen from above, with its wood grain. */
function paintDesk(sketch: p5, place: ReturnType<typeof layout>) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, getColor("NEUTRAL", 800)],
    [1, mix(getColor("NEUTRAL", 800), getColor("BLACK"), 0.5)],
  ]);
  const wood = mix(PLOT_COLORS.orange, getColor("STONE", 600), 0.45);
  const top = height * 0.06;
  withShadow(
    sketch,
    { blur: 26, color: fade(getColor("BLACK"), 0.7), drop: 12 },
    () => {
      gradientRect(
        sketch,
        {
          height: place.edge - top + height * 0.12,
          width: place.right - place.left,
          x: place.left,
          y: top,
        },
        [
          [0, mix(wood, getColor("WHITE"), 0.12)],
          [0.6, wood],
          [1, mix(wood, getColor("BLACK"), 0.35)],
        ]
      );
    }
  );
  sketch.noFill();
  for (let grain = 0; grain < 14; grain += 1) {
    sketch.stroke(
      fade(mix(wood, getColor("BLACK"), 0.4), 0.25 + (grain % 3) * 0.08)
    );
    sketch.strokeWeight(1 + (grain % 2));
    sketch.beginShape();
    for (let step = 0; step <= 30; step += 1) {
      const x = place.left + ((place.right - place.left) * step) / 30;
      const y =
        top +
        height * 0.025 * (grain + 0.6) +
        Math.sin(step * 0.45 + grain * 1.7) * height * 0.004;
      sketch.vertex(x, y);
    }
    sketch.endShape();
  }
  sketch.noStroke();
  spotlight(sketch, { x: width * 0.4, y: height * 0.3 }, width * 0.6, {
    color: mix(PLOT_COLORS.amber, getColor("WHITE"), 0.8),
    strength: 0.2,
  });
  sketch.stroke(fade(getColor("WHITE"), 0.35));
  sketch.strokeWeight(1.5);
  sketch.line(place.left, place.edge, place.right, place.edge);
  sketch.noStroke();
}

/**
 * A pencil lying along the desk's edge from `left`, `length` pixels long:
 * a painted hexagonal body, a sharpened wooden cone with its graphite tip,
 * and a metal ferrule holding a rubber eraser.
 */
function paintPencil(
  sketch: p5,
  left: number,
  edge: number,
  length: number,
  paint: string
) {
  const scale = length / PENCIL_SIZES.length;
  const thick = PENCIL_SIZES.thick * scale;
  const top = edge - thick / 2;
  const cone = PENCIL_SIZES.cone * scale;
  const ferrule = PENCIL_SIZES.ferrule * scale;
  const eraser = PENCIL_SIZES.eraser * scale;
  const body = length - cone - ferrule - eraser;
  const wood = mix(PLOT_COLORS.amber, getColor("WHITE"), 0.55);
  withShadow(
    sketch,
    { blur: 10, color: fade(getColor("BLACK"), 0.55), drop: 6 },
    () => {
      gradientRect(sketch, { height: thick, width: eraser, x: left, y: top }, [
        [0, mix(PLOT_COLORS.pink, getColor("WHITE"), 0.55)],
        [1, mix(PLOT_COLORS.pink, getColor("BLACK"), 0.2)],
      ]);
      gradientRect(
        sketch,
        {
          height: thick * 1.08,
          width: ferrule,
          x: left + eraser,
          y: top - thick * 0.04,
        },
        [
          [0, getColor("SLATE", 50)],
          [0.4, getColor("SLATE", 300)],
          [1, getColor("SLATE", 600)],
        ]
      );
      gradientRect(
        sketch,
        { height: thick, width: body, x: left + eraser + ferrule, y: top },
        [
          [0, mix(paint, getColor("WHITE"), 0.45)],
          [0.33, mix(paint, getColor("WHITE"), 0.15)],
          [0.34, paint],
          [0.66, paint],
          [0.67, mix(paint, getColor("BLACK"), 0.3)],
          [1, mix(paint, getColor("BLACK"), 0.45)],
        ]
      );
      const start = left + eraser + ferrule + body;
      sketch.fill(wood);
      sketch.triangle(start, top, start, top + thick, start + cone, edge);
      sketch.fill(mix(wood, getColor("BLACK"), 0.25));
      sketch.triangle(start, edge, start, top + thick, start + cone, edge);
      sketch.fill(getColor("ZINC", 900));
      sketch.triangle(
        start + cone * 0.7,
        edge - thick * 0.15,
        start + cone * 0.7,
        edge + thick * 0.15,
        start + cone,
        edge
      );
    }
  );
  sketch.stroke(fade(getColor("ZINC", 900), 0.35));
  sketch.strokeWeight(1);
  for (let ridge = 1; ridge < 4; ridge += 1) {
    const x = left + eraser + (ferrule * ridge) / 4;
    sketch.line(x, top, x, top + thick);
  }
  sketch.noStroke();
}

/** A yellow wooden metre rule with centimetre marks, lying from `left`, `metre` pixels to a metre. */
function paintRule(sketch: p5, left: number, edge: number, metre: number) {
  const thick = metre * 0.03;
  withShadow(
    sketch,
    { blur: 12, color: fade(getColor("BLACK"), 0.5), drop: 6 },
    () => {
      gradientRect(sketch, { height: thick, width: metre, x: left, y: edge }, [
        [0, mix(PLOT_COLORS.amber, getColor("WHITE"), 0.5)],
        [1, mix(PLOT_COLORS.amber, getColor("BLACK"), 0.2)],
      ]);
    }
  );
  paintTicks(sketch, {
    color: fade(getColor("ZINC", 900), 0.8),
    count: 101,
    direction: 1,
    length: (index) => thick * tier(index, [10, 5], [0.55, 0.35, 0.2]),
    start: left,
    step: metre / 100,
    weight: 1,
    y: edge,
  });
}

/**
 * The close-up of the reference being laid down, on the desk's wood, so the
 * pencil's paint, ferrule and point, or the rule's marks, read clearly.
 */
function paintClose(sketch: p5, reference: typeof ReferenceSchema.Type) {
  const { height, width } = sketch;
  const left = width * 0.06;
  const top = height * 0.56;
  const closeHeight = height * 0.38;
  const metre = (width * 0.88) / CLOSE_METRES;
  const wood = mix(PLOT_COLORS.orange, getColor("STONE", 600), 0.45);
  withShadow(
    sketch,
    { blur: 22, color: fade(getColor("BLACK"), 0.7), drop: 8 },
    () => {
      gradientRect(
        sketch,
        { height: closeHeight, width: width * 0.88, x: left, y: top },
        [
          [0, mix(wood, getColor("WHITE"), 0.1)],
          [1, mix(wood, getColor("BLACK"), 0.3)],
        ]
      );
    }
  );
  sketch.noFill();
  for (let grain = 0; grain < 7; grain += 1) {
    sketch.stroke(fade(mix(wood, getColor("BLACK"), 0.4), 0.3));
    sketch.strokeWeight(2 + (grain % 2));
    sketch.beginShape();
    for (let step = 0; step <= 30; step += 1) {
      sketch.vertex(
        left + (width * 0.88 * step) / 30,
        top +
          closeHeight * (grain + 0.5) * 0.14 +
          Math.sin(step * 0.3 + grain * 2.1) * height * 0.008
      );
    }
    sketch.endShape();
  }
  sketch.noStroke();
  const edge = top + closeHeight * 0.45;
  if (reference === "rule") {
    paintRule(sketch, left, edge - metre * 0.015, metre);
    return;
  }
  paintPencil(
    sketch,
    left + width * 0.02,
    edge,
    REFERENCES[reference] * metre,
    PAINT[reference]
  );
}

/**
 * Draws one moment: the reference is laid along the desk's edge again and
 * again, and a chalk mark stays at the end of every whole one; the part of
 * the desk left over glows once the last whole one is down.
 */
function deskProgram(sketch: p5, read: () => typeof DeskFrame.Type) {
  let time = 0;
  let shown: typeof ReferenceSchema.Type | undefined;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { reference } = read();
    const { count, whole } = referenceCount(reference);
    const duration = (whole + 1) * STEP_SECONDS;
    if (shown !== reference) {
      shown = reference;
      time = sketch.isLooping() ? 0 : duration;
    }
    if (sketch.isLooping()) {
      time = advanceRun(time, sketch.deltaTime / 1000, {
        duration,
        hold: HOLD_SECONDS,
        rate: 1,
      });
    }
    const step = Math.min(
      Math.floor(shownTime(time, duration) / STEP_SECONDS),
      whole
    );
    const place = layout(sketch);
    const span = REFERENCES[reference] * place.metre;
    paintDesk(sketch, place);
    sketch.stroke(fade(getColor("WHITE"), 0.85));
    sketch.strokeWeight(2.5);
    Arr.forEach(Arr.range(1, Math.min(step, whole)), (mark) => {
      sketch.line(
        place.left + mark * span,
        place.edge - sketch.height * 0.035,
        place.left + mark * span,
        place.edge + sketch.height * 0.01
      );
    });
    sketch.noStroke();
    if (step >= whole && count > whole) {
      sketch.fill(fade(PLOT_COLORS.fuchsia, 0.35));
      sketch.rect(
        place.left + whole * span,
        place.edge - sketch.height * 0.015,
        place.right - place.left - whole * span,
        sketch.height * 0.03
      );
    }
    const left = place.left + step * span;
    if (reference === "rule") {
      paintRule(sketch, left, place.edge - place.metre * 0.015, place.metre);
    } else {
      paintPencil(sketch, left, place.edge, span, PAINT[reference]);
    }
    paintClose(sketch, reference);
    vignette(sketch, 0.4);
  };
}

interface CommonReferenceLabProps {
  description: ReactNode;
  labels: {
    chooseReference: string;
    count: ReactNode;
    desk: ReactNode;
    length: ReactNode;
    references: Record<typeof ReferenceSchema.Type, ReactNode>;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * One desk measured with three friends' pencils and with a metre rule. The
 * pencils give three different counts for one desk; the metre rule gives
 * everyone the same number.
 */
export function CommonReferenceLab({
  description,
  labels,
  title,
}: CommonReferenceLabProps) {
  const [reference, setReference] =
    useState<typeof ReferenceSchema.Type>("short");
  const fixed = useFixed();
  const { count, exact } = referenceCount(reference);
  const isReference = Schema.is(ReferenceSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseReference}
          gridColumns="4"
          onValueChange={(value) => {
            if (isReference(value)) {
              setReference(value);
            }
          }}
          type="single"
          value={reference}
          variant="outline"
        >
          {Arr.map(ReferenceSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.references[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={deskProgram}
          state={{ reference }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.length}
            value={
              <InlineMath
                math={
                  reference === "rule"
                    ? fixed(1, "\\text{ m}", 0)
                    : fixed(REFERENCES[reference] * 100, "\\text{ cm}", 0)
                }
              />
            }
          />
          <VisualFactTabular
            label={labels.count}
            value={
              <InlineMath
                math={`${exact ? "" : "\\approx "}${fixed(count, "", Number.isInteger(count) ? 0 : 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.desk}
            value={<InlineMath math={fixed(DESK_LENGTH, "\\text{ m}", 2)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
