import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  arrow,
  createBackdrop,
  dashed,
  fade,
  gradientRect,
  litBall,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  fitPlan,
  type Plan,
  paintWalker,
  planPoint,
} from "@repo/design-system/components/contents/physics/canvas/town";
import {
  RELEASE_ANGLES,
  type ReleasePoint,
  ReleasePointSchema,
  releaseTime,
  slingPlace,
  whirl,
} from "@repo/design-system/components/contents/physics/kinematics/sling/whirl";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
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

/** How far past the release the ball flies before the run starts again, in seconds. */
const FLIGHT_SECONDS = 0.5;

/** Simulated seconds per wall second, so the whirl can be followed. */
const PLAY_RATE = 0.4;

/** How long the finished throw rests, in wall seconds. */
const HOLD_SECONDS = 1;

/** What the sketch reads on every frame. */
const SlingFrameSchema = Schema.Struct({
  period: Schema.Finite,
  radius: Schema.Finite,
  release: ReleasePointSchema,
});
type SlingFrame = typeof SlingFrameSchema.Type;

/**
 * Draws one moment of the throw from above, on a court: the thrower at the
 * centre, the string to the ball, the ball's velocity tangent to the circle
 * and its acceleration to the centre, and after release the straight path
 * of the free ball.
 */
function slingProgram(sketch: p5, read: () => SlingFrame) {
  let time = Number.POSITIVE_INFINITY;
  const backdrop = createBackdrop();
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { period, radius, release } = read();
    const end = releaseTime(period, release) + FLIGHT_SECONDS;
    if (sketch.isLooping()) {
      time = advanceRun(Math.min(time, end * 2), sketch.deltaTime / 1000, {
        duration: end,
        hold: HOLD_SECONDS,
        rate: PLAY_RATE,
      });
    }
    const now = shownTime(time, end);
    const reach = radius * 2.4;
    const plan: Plan = fitPlan(
      sketch,
      { east: [-reach, reach], north: [-reach, reach] },
      sketch.width * 0.03
    );
    backdrop(sketch, `${radius}:${period}:${release}`, (layer) => {
      gradientRect(
        layer,
        { height: layer.height, width: layer.width, x: 0, y: 0 },
        [
          [0, mix(MATERIAL.pavement, getColor("WHITE"), 0.15)],
          [1, mix(MATERIAL.pavement, getColor("BLACK"), 0.25)],
        ]
      );
      const centre = planPoint(plan, { east: 0, north: 0 });
      layer.noFill();
      layer.stroke(fade(MATERIAL.roadPaint, 0.9));
      layer.strokeWeight(3);
      layer.circle(centre.x, centre.y, radius * 2 * plan.scale);
      const angle = RELEASE_ANGLES[release];
      const from = planPoint(plan, {
        east: radius * Math.cos(angle),
        north: radius * Math.sin(angle),
      });
      const to = planPoint(plan, {
        east: radius * Math.cos(angle) - reach * 2 * Math.sin(angle),
        north: radius * Math.sin(angle) + reach * 2 * Math.cos(angle),
      });
      dashed(layer, from, to, {
        color: fade(PLOT_COLORS.teal, 0.6),
        dash: 8,
        weight: 2,
      });
    });
    const centre = planPoint(plan, { east: 0, north: 0 });
    const place = slingPlace(radius, period, release, now);
    const ball = planPoint(plan, { east: place.x, north: place.y });
    const motion = whirl(radius, period);
    if (!place.released) {
      sketch.stroke(getColor("ZINC", 900));
      sketch.strokeWeight(2);
      sketch.line(centre.x, centre.y, ball.x, ball.y);
      sketch.noStroke();
    }
    paintWalker(sketch, centre, plan.scale * 0.32, PLOT_COLORS.pink);
    const scale = plan.scale * radius * 0.11;
    const angle = Math.atan2(place.y, place.x);
    const tangent = place.released ? RELEASE_ANGLES[release] : angle;
    arrow(
      sketch,
      ball,
      {
        x: ball.x - Math.sin(tangent) * motion.speed * scale,
        y: ball.y - Math.cos(tangent) * motion.speed * scale,
      },
      { color: PLOT_COLORS.teal, head: 12, weight: 3.5 }
    );
    if (!place.released) {
      const pull = plan.scale * radius * 0.6;
      arrow(
        sketch,
        ball,
        {
          x: ball.x - Math.cos(angle) * pull,
          y: ball.y + Math.sin(angle) * pull,
        },
        { color: PLOT_COLORS.fuchsia, head: 12, weight: 3.5 }
      );
    }
    sketch.noStroke();
    sketch.fill(fade(getColor("BLACK"), 0.35));
    sketch.circle(ball.x + 4, ball.y + 4, Math.max(14, plan.scale * 0.12));
    litBall(sketch, ball, Math.max(7, plan.scale * 0.06), {
      dark: mix(PLOT_COLORS.orange, getColor("BLACK"), 0.45),
      light: mix(PLOT_COLORS.orange, getColor("WHITE"), 0.4),
    });
    vignette(sketch, 0.3);
  };
}

interface StringWhirlReleaseLabProps {
  description: ReactNode;
  labels: {
    acceleration: ReactNode;
    chooseRelease: string;
    period: ReactNode;
    radius: ReactNode;
    releases: Record<ReleasePoint, ReactNode>;
    speed: ReactNode;
    viewLabel: string;
  };
  /** The time for one turn, in seconds. */
  period: number;
  /** The length of the string, in metres. */
  radius: number;
  title: ReactNode;
}

/**
 * A ball whirled on a string, seen from above, let go at a point the
 * learner picks. While it turns, its velocity (teal) stays tangent and its
 * acceleration (fuchsia) points to the centre; once let go, nothing pulls it
 * in, so it flies straight along the tangent of the point of release.
 */
export function StringWhirlReleaseLab({
  description,
  labels,
  period,
  radius,
  title,
}: StringWhirlReleaseLabProps) {
  const [release, setRelease] = useState<ReleasePoint>("north");
  const quantity = useQuantity();
  const motion = whirl(radius, period);
  const isRelease = Schema.is(ReleasePointSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseRelease}
          gridColumns="4"
          onValueChange={(value) => {
            if (isRelease(value)) {
              setRelease(value);
            }
          }}
          type="single"
          value={release}
          variant="outline"
        >
          {Arr.map(ReleasePointSchema.literals, (point) => (
            <ToggleGroupItem key={point} value={point}>
              {labels.releases[point]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={slingProgram}
          state={{ period, radius, release }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.radius}
            value={<InlineMath math={quantity(radius, "\\text{ m}", 2)} />}
          />
          <VisualFactTabular
            label={labels.period}
            value={<InlineMath math={quantity(period, "\\text{ s}", 2)} />}
          />
          <VisualFactTabular
            label={labels.speed}
            value={
              <InlineMath math={quantity(motion.speed, "\\text{ m/s}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.acceleration}
            value={
              <InlineMath
                math={quantity(motion.acceleration, "\\text{ m/s}^2", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
