import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  arrow,
  fade,
  gradientRect,
  litBall,
  mix,
  spotlight,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  STROBE_SHOTS,
  type StrobeShot,
  strobeBalls,
  strobeFacts,
  strobeFlashes,
} from "@repo/design-system/components/contents/physics/kinematics/strobe/flash";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
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
import { Array as Arr, Match } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";

/** How long the finished photograph rests before the run starts again, in wall seconds. */
const HOLD_SECONDS = 2;

/** Each shot slowed to about 2.5 wall seconds, so every flash can be followed. */
const PLAY_RATE = {
  components: 0.65,
  drop: 0.25,
  launch: 0.2,
  toss: 0.4,
} as const;

/** The radius of a ball in the photograph, in metres: a steel ball of 7 to 8 cm, or a football (22 cm, FIFA size 5) for the kick. */
const BALL_RADIUS = {
  components: 0.11,
  drop: 0.04,
  launch: 0.035,
  toss: 0.04,
} as const;

/** The colours of each ball: steel for one, orange and teal when two fall side by side. */
const BALL_COLORS = [
  {
    dark: mix(MATERIAL.castIron, getColor("BLACK"), 0.5),
    light: MATERIAL.chrome,
  },
  {
    dark: mix(PLOT_COLORS.teal, getColor("BLACK"), 0.5),
    light: mix(PLOT_COLORS.teal, getColor("WHITE"), 0.45),
  },
] as const;

/** What the sketch reads on every frame: the photograph it develops. */
interface StrobeFrame {
  readonly shot: StrobeShot;
}

/** Maps the shot's frame, in metres, onto the canvas, keeping its proportions. */
function camera(sketch: p5, shot: StrobeShot) {
  const { frame } = STROBE_SHOTS[shot];
  const wide = frame.right - frame.left;
  const tall = frame.top - frame.bottom;
  const scale = Math.min(
    (sketch.width * 0.92) / wide,
    (sketch.height * 0.92) / tall
  );
  const left = (sketch.width - wide * scale) / 2;
  const top = (sketch.height - tall * scale) / 2;
  return {
    scale,
    x: (metres: number) => left + (metres - frame.left) * scale,
    y: (metres: number) => top + (frame.top - metres) * scale,
  };
}

/** The dark room, its grid of 10 cm squares (1 m for the kick), the floor, and a striped metre stick. */
function paintRoom(
  sketch: p5,
  shot: StrobeShot,
  view: ReturnType<typeof camera>
) {
  const { frame } = STROBE_SHOTS[shot];
  gradientRect(
    sketch,
    { height: sketch.height, width: sketch.width, x: 0, y: 0 },
    [
      [0, mix(getColor("ZINC", 900), getColor("SLATE", 800), 0.4)],
      [1, getColor("ZINC", 950)],
    ]
  );
  spotlight(
    sketch,
    { x: sketch.width * 0.5, y: sketch.height * 0.35 },
    sketch.width * 0.6,
    { color: getColor("SLATE", 400), strength: 0.12 }
  );
  const step = shot === "components" ? 1 : 0.1;
  sketch.push();
  sketch.stroke(fade(getColor("SLATE", 300), 0.16));
  sketch.strokeWeight(1);
  for (
    let x = Math.ceil(frame.left / step) * step;
    x <= frame.right;
    x += step
  ) {
    sketch.line(view.x(x), view.y(frame.top), view.x(x), view.y(0));
  }
  for (let y = 0; y <= frame.top; y += step) {
    sketch.line(view.x(frame.left), view.y(y), view.x(frame.right), view.y(y));
  }
  sketch.stroke(fade(getColor("SLATE", 200), 0.65));
  sketch.strokeWeight(2);
  sketch.line(view.x(frame.left), view.y(0), view.x(frame.right), view.y(0));
  sketch.noStroke();
  const stick =
    view.x(frame.left) + view.scale * (frame.right - frame.left) * 0.012;
  const band = shot === "components" ? 0.5 : 0.1;
  for (let y = 0; y < frame.top - 1e-9; y += band) {
    const even = Math.round(y / band) % 2 === 0;
    sketch.fill(even ? MATERIAL.distancePost : getColor("ZINC", 900));
    sketch.rect(
      stick,
      view.y(Math.min(y + band, frame.top)),
      Math.max(6, view.scale * step * 0.25),
      view.scale * Math.min(band, frame.top - y)
    );
  }
  if (shot === "launch") {
    sketch.fill(mix(MATERIAL.bark, getColor("BLACK"), 0.2));
    sketch.rect(
      view.x(frame.left),
      view.y(1.25),
      view.x(0) - view.x(frame.left),
      view.scale * 0.04
    );
  }
  sketch.pop();
}

/** The velocity of a kicked ball at one flash, split into its two components. */
function paintComponents(
  sketch: p5,
  view: ReturnType<typeof camera>,
  time: number
) {
  const [ball] = strobeBalls("components", time);
  if (!ball) {
    return;
  }
  const scale = 0.12;
  const from = { x: view.x(ball.x), y: view.y(ball.y) };
  arrow(
    sketch,
    from,
    { x: view.x(ball.x + ball.vx * scale), y: from.y },
    { color: PLOT_COLORS.teal, head: 7, weight: 2.5 }
  );
  arrow(
    sketch,
    from,
    { x: from.x, y: view.y(ball.y + ball.vy * scale) },
    { color: PLOT_COLORS.violet, head: 7, weight: 2.5 }
  );
}

/**
 * Develops the photograph flash by flash: every image of the ball taken so
 * far stays on the picture, older ones a little fainter, and the newest
 * one shines brightest, as on film with an open shutter.
 */
function strobeProgram(sketch: p5, read: () => StrobeFrame) {
  let time = Number.POSITIVE_INFINITY;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { shot } = read();
    const { duration } = STROBE_SHOTS[shot];
    if (sketch.isLooping()) {
      time = advanceRun(
        Math.min(time, duration + HOLD_SECONDS),
        sketch.deltaTime / 1000,
        { duration, hold: HOLD_SECONDS, rate: PLAY_RATE[shot] }
      );
    }
    const now = shownTime(time, duration);
    const view = camera(sketch, shot);
    paintRoom(sketch, shot, view);
    const radius = Math.max(4, BALL_RADIUS[shot] * view.scale);
    const flashes = Arr.filter(
      strobeFlashes(shot),
      (flash) => flash <= now + 1e-9
    );
    Arr.forEach(flashes, (flash, index) => {
      const age = (flashes.length - 1 - index) / Math.max(flashes.length, 1);
      Arr.forEach(strobeBalls(shot, flash), (ball, which) => {
        const colors = BALL_COLORS[which] ?? BALL_COLORS[0];
        const centre = {
          x: view.x(ball.x),
          y: view.y(ball.y + BALL_RADIUS[shot]),
        };
        spotlight(sketch, centre, radius * 2.4, {
          color: colors.light,
          strength: 0.25 * (1 - age),
        });
        litBall(sketch, centre, radius, {
          dark: fade(colors.dark, 1 - age * 0.45),
          light: fade(colors.light, 1 - age * 0.45),
        });
      });
      if (shot === "components") {
        paintComponents(sketch, view, flash);
      }
    });
    vignette(sketch, 0.4);
  };
}

interface StrobePhotoMotionLabProps {
  description: ReactNode;
  labels: {
    airTime: ReactNode;
    height: ReactNode;
    interval: ReactNode;
    /** The result this photograph is about: landing speed, top height, reach, or range. */
    outcome: ReactNode;
    viewLabel: string;
  };
  /** The photograph to develop. */
  shot: StrobeShot;
  title: ReactNode;
}

/**
 * A strobe photograph built up flash by flash in a dark room: a ball
 * dropped, tossed up, rolled off a table beside a dropped twin, or kicked,
 * shot at equal time intervals against a 10 cm grid. Even sideways gaps
 * show constant horizontal velocity; downward gaps that grow by the same
 * step show the constant pull of gravity.
 */
export function StrobePhotoMotionLab({
  description,
  labels,
  shot,
  title,
}: StrobePhotoMotionLabProps) {
  const quantity = useQuantity();
  const facts = strobeFacts(shot);
  const outcomeUnit = Match.value(shot).pipe(
    Match.when("drop", () => "\\text{ m/s}"),
    Match.orElse(() => "\\text{ m}")
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={strobeProgram}
          state={{ shot }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.interval}
            value={
              <InlineMath
                math={quantity(STROBE_SHOTS[shot].interval, "\\text{ s}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.height}
            value={
              <InlineMath math={quantity(facts.height, "\\text{ m}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.airTime}
            value={
              <InlineMath math={quantity(facts.airTime, "\\text{ s}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.outcome}
            value={
              <InlineMath math={quantity(facts.outcome, outcomeUnit, 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
