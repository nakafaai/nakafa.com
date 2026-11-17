import {
  dashed,
  fade,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  angleArc,
  beam,
  type Point,
  paintDarkRoom,
  paintGlass,
  paintRayBox,
} from "@repo/design-system/components/contents/physics/optics/light";
import {
  AIR_INDEX,
  type Block,
  criticalAngle,
  refract,
  type Spot,
  traceBlock,
} from "@repo/design-system/components/contents/physics/optics/ray";
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
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The block the lab draws, in its own units: wider than tall, as a classroom block lies on the bench. */
const SHAPE = { height: 1, width: 1.6 } as const;

/** Where the ray enters the top face, in block units from its left face. */
const ENTRY = 1;

/** The canvas direction of each face's inward normal, from which the angle at that face is measured. */
const INWARD = { bottom: -Math.PI / 2, left: 0, right: -Math.PI } as const;

/** Seconds a light pulse takes to run the whole path. */
const PULSE_SECONDS = 2.6;

/** What the sketch reads on every frame. */
const BlockFrameSchema = Schema.Struct({
  incidence: Schema.Finite,
  index: Schema.Finite,
});
type BlockFrame = typeof BlockFrameSchema.Type;

/** Where the block sits on a canvas of this size, and its scale in pixels per block unit. */
function layout(sketch: p5) {
  const scale = Math.min(
    (sketch.width * 0.5) / SHAPE.width,
    (sketch.height * 0.46) / SHAPE.height
  );
  const left = sketch.width * 0.6 - (SHAPE.width * scale) / 2;
  const top = sketch.height * 0.42;
  return {
    canvas: (spot: Spot): Point => ({
      x: left + spot.x * scale,
      y: top + (SHAPE.height - spot.y) * scale,
    }),
    left,
    scale,
    top,
  };
}

/** The point `length` pixels from `from` along the canvas direction `angle`. */
function along(from: Point, angle: number, length: number): Point {
  return {
    x: from.x + Math.cos(angle) * length,
    y: from.y + Math.sin(angle) * length,
  };
}

/** The canvas direction of the ray once it leaves a face into the air. */
function exitAngle(
  face: "bottom" | "left" | "right",
  inside: number,
  out: number
) {
  const radians = (out * Math.PI) / 180;
  const leaning = Math.sin(inside);
  if (face === "bottom") {
    return Math.atan2(
      Math.cos(radians),
      Math.sign(Math.cos(inside)) * Math.sin(radians)
    );
  }
  const outward = face === "right" ? 0 : Math.PI;
  return outward + Math.sign(leaning) * radians * (face === "right" ? 1 : -1);
}

/** The whole path of the ray on the canvas, from the ray box to where it leaves the frame. */
function rayPath(sketch: p5, frame: BlockFrame) {
  const place = layout(sketch);
  const block: Block = { ...SHAPE, index: frame.index };
  const { hits, refraction } = traceBlock(block, ENTRY, frame.incidence);
  const entry = place.canvas({ x: ENTRY, y: SHAPE.height });
  const incoming = Math.atan2(
    Math.cos((frame.incidence * Math.PI) / 180),
    Math.sin((frame.incidence * Math.PI) / 180)
  );
  const reach = Math.min(
    place.scale * 0.95,
    (entry.y - sketch.height * 0.05) / Math.max(Math.sin(incoming), 0.05),
    (entry.x - sketch.width * 0.04) / Math.max(Math.cos(incoming), 0.05)
  );
  const source = along(entry, incoming + Math.PI, reach);
  const inside = Arr.map(hits, (hit) => place.canvas(hit.at));
  const points: Arr.NonEmptyReadonlyArray<Point> = [source, entry, ...inside];
  const last = Arr.last(hits);
  const end = Arr.lastNonEmpty(points);
  const before = Option.getOrElse(
    Arr.get(points, points.length - 2),
    () => entry
  );
  const leaving = Option.flatMap(last, (hit) =>
    hit.event === "refracted"
      ? Option.map(refract(frame.index, AIR_INDEX, hit.incidence), (out) =>
          along(
            end,
            exitAngle(
              hit.face,
              Math.atan2(end.y - before.y, end.x - before.x),
              out
            ),
            place.scale * 1.2
          )
        )
      : Option.none()
  );
  return {
    entry,
    hits,
    incoming,
    inside,
    path: Option.match(leaving, {
      onNone: () => points,
      onSome: (out) => [...points, out],
    }),
    place,
    refraction,
    source,
  };
}

/** Draws a dashed normal through `at`, perpendicular to a face. */
function normal(sketch: p5, at: Point, vertical: boolean, length: number) {
  const color = fade(getColor("WHITE"), 0.45);
  const style = { color, dash: 5, weight: 1.2 };
  if (vertical) {
    dashed(
      sketch,
      { x: at.x, y: at.y - length },
      { x: at.x, y: at.y + length },
      style
    );
  } else {
    dashed(
      sketch,
      { x: at.x - length, y: at.y },
      { x: at.x + length, y: at.y },
      style
    );
  }
}

/** Draws a glowing pulse a fraction `phase` of the way along the path. */
function pulse(sketch: p5, path: readonly Point[], phase: number) {
  const lengths = Arr.map(Arr.zip(path, Arr.drop(path, 1)), ([a, b]) =>
    Math.hypot(b.x - a.x, b.y - a.y)
  );
  let left = phase * Arr.reduce(lengths, 0, (sum, length) => sum + length);
  for (const [[from, to], length] of Arr.zip(
    Arr.zip(path, Arr.drop(path, 1)),
    lengths
  )) {
    if (left <= length) {
      const t = left / length;
      const at = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      };
      sketch.noStroke();
      sketch.fill(fade(INSTRUMENT_COLORS.laserBeam, 0.35));
      sketch.circle(at.x, at.y, 18);
      sketch.fill(fade(getColor("WHITE"), 0.95));
      sketch.circle(at.x, at.y, 6);
      return;
    }
    left -= length;
  }
}

/**
 * Draws one moment: the ray box, the beam refracting into the block, each
 * face it meets with its normal, the arc of the angle where it meets the
 * next face against a dashed line at the critical angle, and a light pulse
 * running along the path.
 */
function blockProgram(sketch: p5, read: () => BlockFrame) {
  let clock = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      clock =
        (clock + Math.min(sketch.deltaTime / 1000, 0.1) / PULSE_SECONDS) % 1;
    }
    paintDarkRoom(sketch);
    const ray = rayPath(sketch, frame);
    const { place } = ray;
    paintGlass(sketch, {
      height: SHAPE.height * place.scale,
      width: SHAPE.width * place.scale,
      x: place.left,
      y: place.top,
    });
    normal(sketch, ray.entry, true, place.scale * 0.32);
    const reflected = along(ray.entry, -ray.incoming, place.scale * 0.6);
    beam(sketch, ray.entry, reflected, INSTRUMENT_COLORS.laserBeam, 0.18);
    Arr.forEach(
      Arr.zip(ray.path, Arr.drop(ray.path, 1)),
      ([point, next], index) =>
        beam(
          sketch,
          point,
          next,
          INSTRUMENT_COLORS.laserBeam,
          index === 1 ? 0.85 : 1
        )
    );
    paintRayBox(sketch, ray.source, ray.incoming, place.scale * 0.11);
    const arc = place.scale * 0.2;
    angleArc(
      sketch,
      ray.entry,
      arc,
      { end: -Math.PI / 2, start: ray.incoming - Math.PI },
      PLOT_COLORS.amber
    );
    const inward = Math.PI / 2 - (ray.refraction * Math.PI) / 180;
    angleArc(
      sketch,
      ray.entry,
      arc,
      { end: Math.PI / 2, start: inward },
      PLOT_COLORS.teal
    );
    const first = Arr.head(ray.hits);
    const at = Arr.head(ray.inside);
    if (Option.isSome(first) && Option.isSome(at)) {
      const side = first.value.face !== "bottom";
      normal(sketch, at.value, !side, place.scale * 0.32);
      const back = Math.atan2(
        ray.entry.y - at.value.y,
        ray.entry.x - at.value.x
      );
      const into = INWARD[first.value.face];
      const color =
        first.value.event === "reflected"
          ? PLOT_COLORS.pink
          : PLOT_COLORS.violet;
      angleArc(sketch, at.value, arc, { end: back, start: into }, color);
      const critical = (criticalAngle(frame.index) * Math.PI) / 180;
      const lean = Math.sign(back - into) || 1;
      dashed(
        sketch,
        at.value,
        along(at.value, into + lean * critical, place.scale * 0.45),
        {
          color: fade(PLOT_COLORS.pink, 0.8),
          dash: 4,
          weight: 1.5,
        }
      );
    }
    pulse(sketch, ray.path, clock);
    vignette(sketch, 0.35);
  };
}

interface GlassBlockLabProps {
  description: NonNullable<ReactNode>;
  /** The angle of incidence the ray starts at on the top face, in degrees. */
  incidence: number;
  /** The refractive index of the glass. */
  index: number;
  labels: {
    critical: ReactNode;
    incidence: ReactNode;
    incidenceName: string;
    next: ReactNode;
    outcome: ReactNode;
    reflected: ReactNode;
    refracted: ReactNode;
    refraction: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

/**
 * A ray box aims a narrow beam at the top face of a rectangular glass block.
 * The beam refracts toward the normal, then meets the next face: below the
 * critical angle it leaves, past it it is totally reflected back into the
 * glass. Turn the ray box and watch the decision at that face change.
 */
export function GlassBlockLab({
  description,
  incidence: start,
  index,
  labels,
  title,
}: GlassBlockLabProps) {
  const quantity = useQuantity();
  const [incidence, setIncidence] = useState(start);
  const block: Block = { ...SHAPE, index };
  const { hits, refraction } = traceBlock(block, ENTRY, incidence);
  const first = Arr.head(hits);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.incidence}</span>}
          max={85}
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
          program={blockProgram}
          state={{ incidence, index }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.refraction}
            value={<InlineMath math={quantity(refraction, "^\\circ", 1)} />}
          />
          <VisualFactTabular
            label={labels.next}
            value={
              <InlineMath
                math={quantity(
                  Option.match(first, {
                    onNone: () => 0,
                    onSome: (hit) => hit.incidence,
                  }),
                  "^\\circ",
                  1
                )}
              />
            }
          />
          <VisualFactTabular
            label={labels.critical}
            value={
              <InlineMath math={quantity(criticalAngle(index), "^\\circ", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.outcome}
            value={
              Option.exists(first, (hit) => hit.event === "reflected")
                ? labels.reflected
                : labels.refracted
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
