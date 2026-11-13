import {
  fade,
  gradientRect,
  mix,
  outOfFocus,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import { scientific } from "@repo/design-system/components/contents/physics/measurement/figures";
import {
  HAIR_DIAMETER,
  hairReading,
  OBJECTIVES,
  ObjectiveSchema,
  RETICLE_DIVISIONS,
} from "@repo/design-system/components/contents/physics/measurement/microscope/reticle";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How much of the field's diameter the eyepiece scale spans. */
const SCALE_SPAN = 0.84;

/** How quickly the view zooms to a new objective, per second. */
const ZOOM_RATE = 5;

/** Specks of dust far out of focus: where they sit in the field and how big they are, as parts of its radius. */
const SPECKS = [
  [-0.55, -0.4, 0.09],
  [0.42, -0.6, 0.06],
  [0.6, 0.35, 0.11],
  [-0.35, 0.58, 0.07],
  [0.15, 0.7, 0.05],
] as const;

/** What the sketch reads on every frame: the objective in place. */
const FieldFrame = Schema.Struct({ objective: ObjectiveSchema });

/**
 * The hair as the field shows it, `width` pixels wide and centred on `x`:
 * shaded like a cylinder lit from below, with the overlapping scales of its
 * cuticle and the dark core of its medulla.
 */
function paintHair(sketch: p5, x: number, width: number, field: number) {
  const { height } = sketch;
  const brown = MATERIAL.hair;
  gradientRect(
    sketch,
    { height, width, x: x - width / 2, y: 0 },
    [
      [0, fade(mix(brown, getColor("BLACK"), 0.6), 0.95)],
      [0.18, fade(brown, 0.85)],
      [0.5, fade(mix(brown, getColor("WHITE"), 0.25), 0.7)],
      [0.82, fade(brown, 0.85)],
      [1, fade(mix(brown, getColor("BLACK"), 0.6), 0.95)],
    ],
    true
  );
  const spacing = Math.max(width * 0.22, 3);
  sketch.noFill();
  sketch.stroke(fade(mix(brown, getColor("BLACK"), 0.5), 0.5));
  sketch.strokeWeight(Math.max(width * 0.02, 0.8));
  for (
    let y = sketch.height / 2 - field;
    y < sketch.height / 2 + field;
    y += spacing
  ) {
    sketch.beginShape();
    sketch.vertex(x - width / 2, y + spacing * 0.35);
    sketch.vertex(x - width * 0.1, y);
    sketch.vertex(x + width / 2, y + spacing * 0.2);
    sketch.endShape();
  }
  sketch.stroke(fade(mix(brown, getColor("BLACK"), 0.7), 0.55));
  sketch.strokeWeight(Math.max(width * 0.12, 1));
  for (
    let y = sketch.height / 2 - field;
    y < sketch.height / 2 + field;
    y += spacing * 2.6
  ) {
    sketch.line(x + width * 0.03, y, x + width * 0.03, y + spacing * 1.7);
  }
  sketch.noStroke();
}

/**
 * Draws the round field of the eyepiece: bright-field light, specks out of
 * focus, the hair at the current magnification, and the eyepiece scale,
 * which stays sharp and the same size whatever the objective.
 */
function fieldProgram(sketch: p5, read: () => typeof FieldFrame.Type) {
  let division: number = OBJECTIVES[read().objective].division;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { objective } = read();
    const target = OBJECTIVES[objective].division;
    const step = Math.min(sketch.deltaTime / 1000, 0.1) * ZOOM_RATE;
    division = sketch.isLooping()
      ? Math.exp(
          Math.log(division) +
            (Math.log(target) - Math.log(division)) * Math.min(step, 1)
        )
      : target;
    const { height, width } = sketch;
    const center = { x: width / 2, y: height / 2 };
    const field = Math.min(width, height) * 0.46;
    const perDivision = (field * 2 * SCALE_SPAN) / RETICLE_DIVISIONS;
    sketch.background(getColor("ZINC", 950));
    sketch.push();
    const drawing = sketch.drawingContext;
    if (drawing instanceof CanvasRenderingContext2D) {
      drawing.beginPath();
      drawing.arc(center.x, center.y, field, 0, Math.PI * 2);
      drawing.clip();
      const light = drawing.createRadialGradient(
        center.x,
        center.y,
        0,
        center.x,
        center.y,
        field
      );
      light.addColorStop(0, MATERIAL.microscopeLight);
      light.addColorStop(
        0.75,
        mix(MATERIAL.microscopeLight, MATERIAL.lampLight, 0.6)
      );
      light.addColorStop(
        1,
        mix(MATERIAL.lampLight, getColor("STONE", 600), 0.55)
      );
      drawing.fillStyle = light;
      drawing.fillRect(
        center.x - field,
        center.y - field,
        field * 2,
        field * 2
      );
    }
    outOfFocus(sketch, field * 0.03, () => {
      sketch.fill(
        fade(mix(MATERIAL.hair, MATERIAL.microscopeLight, 0.4), 0.35)
      );
      Arr.forEach(SPECKS, ([x, y, size]) => {
        sketch.circle(
          center.x + x * field,
          center.y + y * field,
          size * field * (25 / division)
        );
      });
    });
    const hairWidth = (HAIR_DIAMETER / division) * perDivision;
    const hairX = center.x - field * 0.12;
    paintHair(sketch, hairX, hairWidth, field);
    const scaleLeft = center.x - field * SCALE_SPAN;
    paintTicks(sketch, {
      color: getColor("ZINC", 950),
      count: RETICLE_DIVISIONS + 1,
      direction: -1,
      length: (index) => field * tier(index, [10, 5], [0.09, 0.065, 0.04]),
      start: scaleLeft,
      step: perDivision,
      weight: Math.max(field * 0.004, 1),
      y: center.y,
    });
    sketch.stroke(getColor("ZINC", 950));
    sketch.strokeWeight(Math.max(field * 0.004, 1));
    sketch.line(
      scaleLeft,
      center.y,
      scaleLeft + RETICLE_DIVISIONS * perDivision,
      center.y
    );
    sketch.stroke(PLOT_COLORS.fuchsia);
    sketch.strokeWeight(3);
    const bracket = center.y + field * 0.06;
    sketch.line(hairX - hairWidth / 2, bracket, hairX + hairWidth / 2, bracket);
    sketch.line(
      hairX - hairWidth / 2,
      bracket - field * 0.03,
      hairX - hairWidth / 2,
      bracket + field * 0.03
    );
    sketch.line(
      hairX + hairWidth / 2,
      bracket - field * 0.03,
      hairX + hairWidth / 2,
      bracket + field * 0.03
    );
    sketch.noStroke();
    sketch.pop();
    const drawingRing = sketch.drawingContext;
    if (drawingRing instanceof CanvasRenderingContext2D) {
      const ring = drawingRing.createRadialGradient(
        center.x,
        center.y,
        field * 0.86,
        center.x,
        center.y,
        field
      );
      ring.addColorStop(0, fade(getColor("BLACK"), 0));
      ring.addColorStop(1, fade(getColor("BLACK"), 0.65));
      sketch.push();
      drawingRing.fillStyle = ring;
      drawingRing.beginPath();
      drawingRing.arc(center.x, center.y, field, 0, Math.PI * 2);
      drawingRing.fill();
      sketch.pop();
    }
  };
}

interface MicroscopeScaleLabProps {
  description: ReactNode;
  labels: {
    chooseObjective: string;
    diameter: ReactNode;
    divisions: ReactNode;
    metres: ReactNode;
    oneDivision: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A hair seen through a microscope with a scale in its eyepiece. Switch the
 * objective: the hair spans more divisions at a higher magnification, each
 * division covers fewer micrometres, and the diameter comes out the same,
 * with more significant figures, as a tiny number of metres.
 */
export function MicroscopeScaleLab({
  description,
  labels,
  title,
}: MicroscopeScaleLabProps) {
  const [objective, setObjective] =
    useState<typeof ObjectiveSchema.Type>("medium");
  const fixed = useFixed();
  const { diameter, divisions, figures } = hairReading(objective);
  const metres = scientific(diameter / 1_000_000, figures);
  const isObjective = Schema.is(ObjectiveSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseObjective}
          gridColumns="3"
          onValueChange={(value) => {
            if (isObjective(value)) {
              setObjective(value);
            }
          }}
          type="single"
          value={objective}
          variant="outline"
        >
          {Arr.map(ObjectiveSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              <InlineMath math={`${OBJECTIVES[option].power}\\times`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={fieldProgram}
          state={{ objective }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.oneDivision}
            value={
              <InlineMath
                math={fixed(
                  OBJECTIVES[objective].division,
                  "\\ \\mu\\text{m}",
                  objective === "high" ? 1 : 0
                )}
              />
            }
          />
          <VisualFactTabular
            label={labels.divisions}
            value={<InlineMath math={fixed(divisions, "", 1)} />}
          />
          <VisualFactTabular
            label={labels.diameter}
            value={
              <InlineMath
                math={fixed(
                  Math.round(diameter * 10 ** (figures - 2)) /
                    10 ** (figures - 2),
                  "\\ \\mu\\text{m}",
                  figures - 2
                )}
              />
            }
          />
          <VisualFactTabular
            label={labels.metres}
            value={
              <InlineMath
                math={`${fixed(metres.coefficient, "", figures - 1)}\\times10^{${metres.exponent}}\\text{ m}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
