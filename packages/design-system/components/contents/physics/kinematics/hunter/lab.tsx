import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  createBackdrop,
  dashed,
  fade,
  gradientRect,
  litBall,
  mix,
  spotlight,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  AIM_ANGLE,
  AIM_GRAVITY,
  aimOutcome,
  aimPlaces,
  TARGET,
} from "@repo/design-system/components/contents/physics/kinematics/hunter/aim";
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
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The room the camera frames, in metres from the launcher. */
const ROOM = { bottom: -0.25, left: -0.6, right: 4.6, top: 2.6 } as const;

/** The time between the ghost images left along each path, in seconds. */
const FLASH = 0.05;

/** Simulated seconds per wall second. */
const PLAY_RATE = 0.3;

/** How long the finished shot rests, in wall seconds. */
const HOLD_SECONDS = 1.5;

/** What the sketch reads on every frame. */
interface HunterFrame {
  readonly speed: number;
}

/** Maps the room in metres onto the canvas, keeping its proportions. */
function roomView(sketch: p5) {
  const scale = Math.min(
    sketch.width / (ROOM.right - ROOM.left),
    sketch.height / (ROOM.top - ROOM.bottom)
  );
  const left = (sketch.width - (ROOM.right - ROOM.left) * scale) / 2;
  const top = (sketch.height - (ROOM.top - ROOM.bottom) * scale) / 2;
  return {
    scale,
    x: (metres: number) => left + (metres - ROOM.left) * scale,
    y: (metres: number) => top + (ROOM.top - metres) * scale,
  };
}

/** The lab: dark walls, a bench-top floor, the launcher tube, and the electromagnet on its stand. */
function paintLab(sketch: p5, view: ReturnType<typeof roomView>) {
  gradientRect(
    sketch,
    { height: sketch.height, width: sketch.width, x: 0, y: 0 },
    [
      [0, mix(getColor("ZINC", 900), getColor("SLATE", 800), 0.5)],
      [1, getColor("ZINC", 950)],
    ]
  );
  spotlight(sketch, { x: view.x(2), y: view.y(1.6) }, sketch.width * 0.55, {
    color: getColor("SLATE", 300),
    strength: 0.14,
  });
  gradientRect(
    sketch,
    {
      height: sketch.height - view.y(0),
      width: sketch.width,
      x: 0,
      y: view.y(0),
    },
    [
      [0, mix(MATERIAL.bark, getColor("WHITE"), 0.15)],
      [1, mix(MATERIAL.bark, getColor("BLACK"), 0.5)],
    ]
  );
  sketch.noStroke();
  sketch.fill(MATERIAL.lampPost);
  sketch.rect(
    view.x(TARGET.distance + 0.12),
    view.y(TARGET.height + 0.35),
    view.scale * 0.05,
    view.y(0) - view.y(TARGET.height + 0.35)
  );
  sketch.rect(
    view.x(TARGET.distance - 0.05),
    view.y(TARGET.height + 0.35),
    view.scale * 0.22,
    view.scale * 0.05
  );
  sketch.fill(MATERIAL.castIron);
  sketch.rect(
    view.x(TARGET.distance - 0.06),
    view.y(TARGET.height + 0.31),
    view.scale * 0.12,
    view.scale * 0.1,
    2
  );
  dashed(
    sketch,
    { x: view.x(0), y: view.y(0) },
    { x: view.x(TARGET.distance), y: view.y(TARGET.height) },
    { color: fade(PLOT_COLORS.amber, 0.55), dash: 7, weight: 1.6 }
  );
  sketch.push();
  sketch.translate(view.x(0), view.y(0));
  sketch.rotate(-AIM_ANGLE);
  sketch.fill(MATERIAL.chrome);
  sketch.rect(
    -view.scale * 0.05,
    -view.scale * 0.05,
    view.scale * 0.42,
    view.scale * 0.1,
    3
  );
  sketch.pop();
  sketch.fill(MATERIAL.lampPost);
  sketch.rect(view.x(-0.15), view.y(0.02), view.scale * 0.3, view.scale * 0.06);
}

/** The can: a lit cylinder seen from the side, hanging or falling. */
function paintCan(
  sketch: p5,
  view: ReturnType<typeof roomView>,
  at: { readonly x: number; readonly y: number }
) {
  const wide = view.scale * 0.1;
  const tall = view.scale * 0.16;
  gradientRect(
    sketch,
    {
      height: tall,
      width: wide,
      x: view.x(at.x) - wide / 2,
      y: view.y(at.y) - tall + view.scale * 0.04,
    },
    [
      [0, mix(MATERIAL.chrome, getColor("BLACK"), 0.35)],
      [0.35, MATERIAL.chrome],
      [1, mix(MATERIAL.castIron, getColor("BLACK"), 0.4)],
    ],
    true
  );
}

/**
 * Draws the shot: the ball leaves the launcher aimed straight at the can at
 * the moment the can drops, and ghost images every 0.05 s show both falling
 * the same distance below their straight paths.
 */
function hunterProgram(sketch: p5, read: () => HunterFrame) {
  let time = Number.POSITIVE_INFINITY;
  const backdrop = createBackdrop();
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { speed } = read();
    const outcome = aimOutcome(speed);
    const end = outcome.hit
      ? outcome.meet
      : Math.sqrt((2 * TARGET.height) / AIM_GRAVITY) + 0.2;
    if (sketch.isLooping()) {
      time = advanceRun(Math.min(time, end * 2), sketch.deltaTime / 1000, {
        duration: end,
        hold: HOLD_SECONDS,
        rate: PLAY_RATE,
      });
    }
    const now = shownTime(time, end);
    const view = roomView(sketch);
    backdrop(sketch, "hunter", (layer) => paintLab(layer, view));
    for (let flash = 0; flash < now - 1e-9; flash += FLASH) {
      const ghost = aimPlaces(speed, flash);
      sketch.noStroke();
      sketch.fill(fade(PLOT_COLORS.orange, 0.25));
      sketch.circle(
        view.x(ghost.ball.x),
        view.y(ghost.ball.y),
        view.scale * 0.07
      );
      sketch.fill(fade(MATERIAL.chrome, 0.18));
      sketch.circle(
        view.x(ghost.can.x),
        view.y(ghost.can.y + 0.06),
        view.scale * 0.08
      );
    }
    const places = aimPlaces(speed, now);
    paintCan(sketch, view, places.can);
    const ball = { x: view.x(places.ball.x), y: view.y(places.ball.y + 0.03) };
    spotlight(sketch, ball, view.scale * 0.12, {
      color: PLOT_COLORS.orange,
      strength: 0.4,
    });
    litBall(sketch, ball, view.scale * 0.035, {
      dark: mix(PLOT_COLORS.orange, getColor("BLACK"), 0.45),
      light: mix(PLOT_COLORS.orange, getColor("WHITE"), 0.45),
    });
    vignette(sketch, 0.35);
  };
}

interface FallingTargetAimLabProps {
  description: ReactNode;
  labels: {
    drop: ReactNode;
    meetTime: ReactNode;
    speed: ReactNode;
    speedName: string;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * The falling-target demonstration: a launcher aimed straight at a can 4 m
 * away and 2 m up fires at the instant the can is let go. Gravity pulls the
 * ball and the can down by the same amount in the same time, so at every
 * launch speed fast enough to arrive before the can lands, the ball meets it.
 */
export function FallingTargetAimLab({
  description,
  labels,
  title,
}: FallingTargetAimLabProps) {
  const [speed, setSpeed] = useState(10);
  const quantity = useQuantity();
  const outcome = aimOutcome(speed);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.speed}
          max={16}
          min={5}
          name={labels.speedName}
          onValueChange={setSpeed}
          readout={<InlineMath math={quantity(speed, "\\text{ m/s}", 0)} />}
          step={1}
          value={speed}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={hunterProgram}
          state={{ speed }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.meetTime}
            value={
              <InlineMath math={quantity(outcome.meet, "\\text{ s}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.drop}
            value={
              <InlineMath
                math={quantity(
                  Math.min(outcome.drop, TARGET.height),
                  "\\text{ m}",
                  2
                )}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
