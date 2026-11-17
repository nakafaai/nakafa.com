import {
  arrow,
  dashed,
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { angleArc } from "@repo/design-system/components/contents/physics/optics/light";
import { refractWave } from "@repo/design-system/components/contents/physics/waves/wave";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** Wall seconds a crest takes to move one wavelength, whatever the real frequency. */
const PERIOD_SECONDS = 1.1;

/** What the sketch reads on every frame. */
const TankFrameSchema = Schema.Struct({
  deep: Schema.Finite,
  incidence: Schema.Finite,
  shallow: Schema.Finite,
  wavelength: Schema.Finite,
});
type TankFrame = typeof TankFrameSchema.Type;

/** The water of the tank seen from above: deep water darker, and paler over the glass plate that makes it shallow. */
function paintWater(sketch: p5, boundary: number) {
  const { height, width } = sketch;
  gradientRect(sketch, { height: boundary, width, x: 0, y: 0 }, [
    [0, mix(MATERIAL.seawaterDeep, getColor("BLACK"), 0.2)],
    [1, MATERIAL.seawaterDeep],
  ]);
  gradientRect(
    sketch,
    { height: height - boundary, width, x: 0, y: boundary },
    [
      [0, MATERIAL.seawater],
      [1, mix(MATERIAL.seawater, MATERIAL.waterGlint, 0.25)],
    ]
  );
  sketch.stroke(fade(MATERIAL.waterGlint, 0.6));
  sketch.strokeWeight(2);
  sketch.line(0, boundary, width, boundary);
}

/**
 * Draws the crests of the wave as bright lines: in the deep water they lie
 * across the direction of travel one wavelength apart, and in the shallow
 * water the phase carries on across the boundary, so each crest kinks there
 * and the crests close up to the shorter wavelength.
 */
function paintCrests(
  sketch: p5,
  frame: TankFrame,
  place: { readonly boundary: number; readonly scale: number },
  phase: number
) {
  const shallow = refractWave(
    {
      incidence: frame.incidence,
      speed: frame.deep,
      wavelength: frame.wavelength,
    },
    frame.shallow
  );
  const turn = (frame.incidence * Math.PI) / 180;
  const bend = (shallow.refraction * Math.PI) / 180;
  const { boundary, scale } = place;
  const centre = sketch.width / 2;
  const reach = Math.hypot(sketch.width, sketch.height) / scale;
  const count =
    Math.ceil(reach / Math.min(frame.wavelength, shallow.wavelength)) + 2;
  for (let crest = -count; crest <= count; crest += 1) {
    const level = crest + phase;
    // The crest meets the boundary at x0, where its phase is the same on both sides.
    const x0 =
      Math.abs(Math.sin(turn)) < 1e-6
        ? Number.NaN
        : (level * frame.wavelength) / Math.sin(turn);
    const deepAt = (y: number) => ({
      x:
        centre +
        (Number.isNaN(x0) ? 0 : x0 * scale) +
        (y * Math.cos(turn) * scale) / Math.max(Math.sin(turn), 1e-6),
      y: boundary - y * scale,
    });
    sketch.stroke(fade(MATERIAL.waterGlint, 0.75));
    sketch.strokeWeight(3);
    if (Number.isNaN(x0)) {
      const yDeep = boundary - level * frame.wavelength * scale;
      const yShallow = boundary - level * shallow.wavelength * scale;
      if (yDeep < boundary) {
        sketch.line(0, yDeep, sketch.width, yDeep);
      }
      if (yShallow > boundary) {
        sketch.line(0, yShallow, sketch.width, yShallow);
      }
      continue;
    }
    const top = deepAt(reach);
    const meet = deepAt(0);
    sketch.line(meet.x, meet.y, top.x, top.y);
    const down = reach;
    const end = {
      x:
        meet.x -
        (down * Math.cos(bend) * scale) / Math.max(Math.sin(bend), 1e-6),
      y: boundary + down * scale,
    };
    sketch.line(meet.x, meet.y, end.x, end.y);
  }
}

/**
 * Draws one moment of the ripple tank from above: the deep and shallow
 * water, the moving crests, and a ray along the direction of travel that
 * bends toward the normal at the boundary, with both angles marked.
 */
function tankProgram(sketch: p5, read: () => TankFrame) {
  let phase = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      phase =
        (phase + Math.min(sketch.deltaTime / 1000, 0.1) / PERIOD_SECONDS) % 1;
    }
    const boundary = sketch.height * 0.5;
    const scale =
      Math.min(sketch.width, sketch.height) / (frame.wavelength * 7);
    paintWater(sketch, boundary);
    paintCrests(sketch, frame, { boundary, scale }, phase);
    const shallow = refractWave(
      {
        incidence: frame.incidence,
        speed: frame.deep,
        wavelength: frame.wavelength,
      },
      frame.shallow
    );
    const meet = { x: sketch.width / 2, y: boundary };
    const length = Math.min(sketch.width, sketch.height) * 0.36;
    const turn = (frame.incidence * Math.PI) / 180;
    const bend = (shallow.refraction * Math.PI) / 180;
    const from = {
      x: meet.x - Math.sin(turn) * length,
      y: meet.y - Math.cos(turn) * length,
    };
    const to = {
      x: meet.x + Math.sin(bend) * length,
      y: meet.y + Math.cos(bend) * length,
    };
    dashed(
      sketch,
      { x: meet.x, y: meet.y - length },
      { x: meet.x, y: meet.y + length },
      {
        color: fade(getColor("WHITE"), 0.6),
        dash: 6,
        weight: 1.5,
      }
    );
    arrow(sketch, from, meet, {
      color: PLOT_COLORS.amber,
      head: 12,
      weight: 3,
    });
    arrow(sketch, meet, to, { color: PLOT_COLORS.pink, head: 12, weight: 3 });
    const arc = length * 0.35;
    angleArc(
      sketch,
      meet,
      arc,
      { end: -Math.PI / 2, start: -Math.PI / 2 - turn },
      PLOT_COLORS.amber
    );
    angleArc(
      sketch,
      meet,
      arc,
      { end: Math.PI / 2, start: Math.PI / 2 - bend },
      PLOT_COLORS.pink
    );
    vignette(sketch, 0.3);
  };
}

interface RippleTankLabProps {
  /** The wave speed in the deep water, in centimetres per second. */
  deepSpeed: number;
  description: NonNullable<ReactNode>;
  /** The angle of incidence the wave starts at, in degrees. */
  incidence: number;
  labels: {
    frequency: ReactNode;
    incidence: ReactNode;
    incidenceName: string;
    refraction: ReactNode;
    viewLabel: string;
    wavelength: ReactNode;
  };
  /** The wave speed in the shallow water, in centimetres per second. */
  shallowSpeed: number;
  title: NonNullable<ReactNode>;
  /** The wavelength in the deep water, in centimetres. */
  wavelength: number;
}

/**
 * A ripple tank seen from above, with a glass plate under one half that
 * makes the water shallow. Straight crests cross from deep to shallow water:
 * the dipper keeps their frequency, so where they slow down they close up to
 * a shorter wavelength and turn toward the normal. Tilt the dipper and watch
 * both angles change.
 */
export function RippleTankLab({
  deepSpeed,
  description,
  incidence: start,
  labels,
  shallowSpeed,
  title,
  wavelength,
}: RippleTankLabProps) {
  const quantity = useQuantity();
  const [incidence, setIncidence] = useState(start);
  const shallow = refractWave(
    { incidence, speed: deepSpeed, wavelength },
    shallowSpeed
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.incidence}</span>}
          max={70}
          min={0}
          name={labels.incidenceName}
          onValueChange={setIncidence}
          readout={<InlineMath math={quantity(incidence, "^\\circ", 0)} />}
          step={1}
          value={incidence}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={tankProgram}
          state={{
            deep: deepSpeed,
            incidence,
            shallow: shallowSpeed,
            wavelength,
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.frequency}
            value={
              <InlineMath
                math={quantity(shallow.frequency, "\\text{ Hz}", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.wavelength}
            value={
              <InlineMath
                math={quantity(shallow.wavelength, "\\text{ cm}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.refraction}
            value={
              <InlineMath math={quantity(shallow.refraction, "^\\circ", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
