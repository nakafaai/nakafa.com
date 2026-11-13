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
import {
  BAG_MASS,
  bagHeight,
  DESCENT_MINUTES,
  type Descent,
  DescentSchema,
  DROP_ENERGY,
  DROP_HEIGHT,
  descentSeconds,
  dropPower,
} from "@repo/design-system/components/contents/physics/renewable-energy/lamp/drop";
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How many wall seconds a whole descent plays in, sped up from minutes. */
const PLAY_SECONDS = 7;

/** How long the empty lamp rests before the bag is lifted again, in wall seconds. */
const HOLD_SECONDS = 1.2;

/** The brightest power on offer, which draws the lamp at full glow. */
const BRIGHTEST = dropPower("fast");

/** What the sketch reads on every frame: how slowly the bag sinks. */
interface LampFrame {
  readonly descent: Descent;
}

/** The wall and floor of a dark room, which only the lamp lights. */
function paintRoom(sketch: p5, floor: number) {
  const { height, width } = sketch;
  gradientRect(sketch, { height: floor, width, x: 0, y: 0 }, [
    [0, mix(getColor("NEUTRAL", 800), getColor("BLACK"), 0.55)],
    [1, getColor("NEUTRAL", 800)],
  ]);
  gradientRect(sketch, { height: height - floor, width, x: 0, y: floor }, [
    [0, mix(getColor("STONE", 600), getColor("BLACK"), 0.45)],
    [1, mix(getColor("STONE", 600), getColor("BLACK"), 0.8)],
  ]);
}

/** The lamp unit on the wall, its glow and the light it throws down the wall. */
function paintLamp(
  sketch: p5,
  at: { x: number; y: number },
  size: number,
  glow: number
) {
  spotlight(sketch, { x: at.x, y: at.y + size * 2.2 }, size * 7, {
    color: mix(PLOT_COLORS.amber, getColor("WHITE"), 0.8),
    strength: 0.55 * glow,
  });
  withShadow(
    sketch,
    { blur: 12, color: fade(getColor("BLACK"), 0.6), drop: 5 },
    () => {
      gradientRect(
        sketch,
        {
          height: size * 1.1,
          width: size * 1.6,
          x: at.x - size * 0.8,
          y: at.y - size * 0.55,
        },
        [
          [0, getColor("SLATE", 300)],
          [1, getColor("SLATE", 600)],
        ]
      );
    }
  );
  sketch.noStroke();
  sketch.fill(
    fade(mix(PLOT_COLORS.amber, getColor("WHITE"), 0.9), 0.25 + 0.75 * glow)
  );
  sketch.ellipse(at.x, at.y + size * 0.62, size * 0.9, size * 0.28);
  spotlight(sketch, { x: at.x, y: at.y + size * 0.62 }, size * 1.4, {
    color: getColor("WHITE"),
    strength: 0.8 * glow,
  });
}

/** The cord from the lamp's gear to the bag, and the bag of sand on its end. */
function paintBag(
  sketch: p5,
  from: { x: number; y: number },
  bottom: number,
  size: number
) {
  sketch.stroke(getColor("ZINC", 100));
  sketch.strokeWeight(1.5);
  sketch.line(from.x, from.y, from.x, bottom - size);
  sketch.noStroke();
  withShadow(
    sketch,
    { blur: 14, color: fade(getColor("BLACK"), 0.6), drop: 6 },
    () => {
      gradientRect(
        sketch,
        {
          height: size,
          width: size * 0.8,
          x: from.x - size * 0.4,
          y: bottom - size,
        },
        [
          [0, mix(SAND, getColor("WHITE"), 0.2)],
          [0.5, SAND],
          [1, mix(SAND, getColor("BLACK"), 0.5)],
        ]
      );
    }
  );
}

/** The tone of a canvas bag of sand. */
const SAND = mix(PLOT_COLORS.amber, getColor("STONE", 600), 0.55);

/**
 * Draws one moment of the descent, sped up from minutes to seconds: the bag
 * sinks at a steady rate and the lamp glows as brightly as the power it gets.
 */
function lampProgram(sketch: p5, read: () => LampFrame) {
  let time = 0;
  let shown: Descent | undefined;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { descent } = read();
    const duration = descentSeconds(descent);
    if (shown !== descent) {
      shown = descent;
      time = sketch.isLooping() ? 0 : duration * 0.35;
    }
    if (sketch.isLooping()) {
      time = advanceRun(time, sketch.deltaTime / 1000, {
        duration,
        hold: HOLD_SECONDS,
        rate: duration / PLAY_SECONDS,
      });
    }
    const now = shownTime(time, duration);
    const { height, width } = sketch;
    const floor = height * 0.88;
    const lamp = { x: width * 0.42, y: height * 0.14 };
    const size = Math.max(height * 0.09, 22);
    const metre = (floor - lamp.y - size) / (DROP_HEIGHT + 0.25);
    const falling = now < duration;
    const glow = falling ? dropPower(descent) / BRIGHTEST : 0;
    paintRoom(sketch, floor);
    paintLamp(sketch, lamp, size, glow);
    const bottom = floor - bagHeight(descent, now) * metre;
    sketch.fill(fade(getColor("BLACK"), 0.45));
    sketch.ellipse(lamp.x + size * 0.5, floor + 3, size * 1.1, size * 0.18);
    paintBag(
      sketch,
      { x: lamp.x + size * 0.5, y: lamp.y + size * 0.5 },
      bottom,
      size * 1.15
    );
    sketch.stroke(fade(getColor("WHITE"), 0.35));
    sketch.strokeWeight(1);
    const rulerX = width * 0.7;
    sketch.line(rulerX, floor, rulerX, floor - DROP_HEIGHT * metre);
    for (let tenth = 0; tenth <= DROP_HEIGHT * 10 + 1e-9; tenth += 1) {
      const long = tenth % 5 === 0;
      const y = floor - (tenth / 10) * metre;
      sketch.line(rulerX - (long ? 8 : 4), y, rulerX + (long ? 8 : 4), y);
    }
    sketch.noStroke();
    sketch.fill(PLOT_COLORS.teal);
    sketch.triangle(
      rulerX + 12,
      bottom,
      rulerX + 22,
      bottom - 6,
      rulerX + 22,
      bottom + 6
    );
    vignette(sketch, 0.45);
  };
}

interface WeightLampEnergyLabProps {
  /** How slowly the bag sinks first. */
  descent?: Descent;
  description: ReactNode;
  labels: {
    chooseDescent: string;
    drop: ReactNode;
    energy: ReactNode;
    mass: ReactNode;
    power: ReactNode;
    time: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A gravity lamp in a dark room: a 12 kg bag sinks 1.8 m and turns a small
 * generator that lights an LED. The bag always releases 216 J; a slower
 * descent spreads it over more minutes, so the lamp burns longer and dimmer.
 */
export function WeightLampEnergyLab({
  description,
  descent: initialDescent = "steady",
  labels,
  title,
}: WeightLampEnergyLabProps) {
  const [descent, setDescent] = useState<Descent>(initialDescent);
  const measure = useQuantity();
  const isDescent = Schema.is(DescentSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseDescent}
          gridColumns="3"
          onValueChange={(value) => {
            if (isDescent(value)) {
              setDescent(value);
            }
          }}
          type="single"
          value={descent}
          variant="outline"
        >
          {Arr.map(DescentSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              <InlineMath
                math={measure(DESCENT_MINUTES[option], "\\text{ min}", 0)}
              />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={lampProgram}
          state={{ descent }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.mass}
            value={<InlineMath math={measure(BAG_MASS, "\\text{ kg}", 0)} />}
          />
          <VisualFactTabular
            label={labels.drop}
            value={<InlineMath math={measure(DROP_HEIGHT, "\\text{ m}", 1)} />}
          />
          <VisualFactTabular
            label={labels.energy}
            value={<InlineMath math={measure(DROP_ENERGY, "\\text{ J}", 0)} />}
          />
          <VisualFactTabular
            label={labels.time}
            value={
              <InlineMath
                math={measure(descentSeconds(descent), "\\text{ s}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath math={measure(dropPower(descent), "\\text{ W}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
