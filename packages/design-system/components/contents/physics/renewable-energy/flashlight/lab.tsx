import { advanceRun } from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  fade,
  gradientRect,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  BATTERY_ENERGY,
  type Bulb,
  BulbSchema,
  heatPower,
  INPUT_POWER,
  LIGHT_SHARE,
  lightPower,
  RUN_TIME,
} from "@repo/design-system/components/contents/physics/renewable-energy/flashlight/bulb";
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
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How many wall seconds the 7.5 h of battery life plays in. */
const PLAY_SECONDS = 8;

/** How long the flat battery rests before it is swapped for a fresh one, in wall seconds. */
const HOLD_SECONDS = 1;

/** The marks of the light and the heat, shared by the heat shimmer, the cells and the facts. */
const LIGHT_COLOR = mix(PLOT_COLORS.amber, getColor("WHITE"), 0.55);
const HEAT_COLOR = PLOT_COLORS.pink;
const CHARGE_COLOR = PLOT_COLORS.teal;

/** The tint of each bulb's light: a filament glows warm, an LED white. */
const BEAM_TINT = {
  filament: MATERIAL.filamentGlow,
  led: MATERIAL.ledGlow,
} as const;

/** What the sketch reads on every frame: the bulb in the flashlight. */
const FlashlightFrameSchema = Schema.Struct({ bulb: BulbSchema });
type FlashlightFrame = typeof FlashlightFrameSchema.Type;

/** The dark room, the table and the wall the beam lands on. */
function paintRoom(sketch: p5, table: number, wall: number) {
  const { height, width } = sketch;
  gradientRect(sketch, { height: table, width: wall, x: 0, y: 0 }, [
    [0, mix(MATERIAL.wallPlaster, getColor("BLACK"), 0.93)],
    [1, mix(MATERIAL.wallPlaster, getColor("BLACK"), 0.82)],
  ]);
  gradientRect(
    sketch,
    { height, width: width - wall, x: wall, y: 0 },
    [
      [0, mix(MATERIAL.wallPlaster, getColor("BLACK"), 0.9)],
      [1, mix(MATERIAL.wallPlaster, getColor("BLACK"), 0.75)],
    ],
    true
  );
  gradientRect(
    sketch,
    { height: height - table, width: wall, x: 0, y: table },
    [
      [0, mix(MATERIAL.crateWood, getColor("BLACK"), 0.55)],
      [1, mix(MATERIAL.crateWood, getColor("BLACK"), 0.85)],
    ]
  );
}

/** The beam from the lens to the wall, as bright as the light the bulb gives. */
function paintBeam(
  sketch: p5,
  lens: { x: number; y: number },
  wall: number,
  bulb: Bulb,
  brightness: number
) {
  const { height } = sketch;
  const spread = height * 0.32;
  sketch.fill(fade(BEAM_TINT[bulb], 0.05 + 0.3 * brightness));
  sketch.quad(
    lens.x,
    lens.y - 8,
    wall,
    lens.y - spread,
    wall,
    lens.y + spread,
    lens.x,
    lens.y + 8
  );
  spotlight(sketch, { x: wall, y: lens.y }, spread * 1.2, {
    color: BEAM_TINT[bulb],
    strength: 0.15 + 0.75 * brightness,
  });
}

/** The flashlight in cutaway: its two cells draining, the bulb's glow and the heat around the head. */
function paintTorch(
  sketch: p5,
  body: { x: number; y: number; width: number; height: number },
  bulb: Bulb,
  charge: number,
  time: number
) {
  withShadow(
    sketch,
    { blur: 16, color: fade(getColor("BLACK"), 0.7), drop: 8 },
    () => {
      gradientRect(sketch, body, [
        [0, MATERIAL.panSteel],
        [0.45, MATERIAL.castIron],
        [1, mix(MATERIAL.castIron, getColor("BLACK"), 0.6)],
      ]);
    }
  );
  const cell = {
    height: body.height * 0.56,
    width: body.width * 0.36,
    y: body.y + body.height * 0.22,
  };
  for (let index = 0; index < 2; index += 1) {
    const left = body.x + body.width * (0.06 + index * 0.4);
    sketch.fill(MATERIAL.battery);
    sketch.rect(left, cell.y, cell.width, cell.height, 3);
    sketch.fill(MATERIAL.brass);
    sketch.rect(
      left + cell.width,
      cell.y + cell.height * 0.3,
      cell.width * 0.05,
      cell.height * 0.4,
      1
    );
    sketch.fill(fade(CHARGE_COLOR, 0.9));
    sketch.rect(
      left + 3,
      cell.y + cell.height * 0.38,
      (cell.width - 6) * charge,
      cell.height * 0.24,
      2
    );
  }
  const head = { x: body.x + body.width, y: body.y + body.height / 2 };
  const heat = heatPower(bulb) / INPUT_POWER;
  sketch.noFill();
  sketch.stroke(fade(HEAT_COLOR, 0.25 + 0.5 * heat));
  sketch.strokeWeight(1.5 + heat * 2.5);
  for (let wisp = 0; wisp < 3; wisp += 1) {
    sketch.beginShape();
    for (let step = 0; step <= 8; step += 1) {
      const rise = step / 8;
      sketch.vertex(
        head.x - 10 + wisp * 12 + Math.sin(rise * 8 + time * 3 + wisp) * 4,
        head.y - body.height * 0.7 - rise * body.height * 1.6
      );
    }
    sketch.endShape();
  }
  sketch.noStroke();
  sketch.fill(MATERIAL.chrome);
  sketch.quad(
    head.x,
    body.y,
    head.x + body.height * 0.5,
    body.y - body.height * 0.25,
    head.x + body.height * 0.5,
    body.y + body.height * 1.25,
    head.x,
    body.y + body.height
  );
  spotlight(
    sketch,
    { x: head.x + body.height * 0.4, y: head.y },
    body.height * (0.8 + heat),
    {
      color: MATERIAL.filamentGlow,
      strength: 0.6 * heat,
    }
  );
  return { x: head.x + body.height * 0.5, y: head.y };
}

/** Draws the flashlight shining at the wall while its battery drains over 7.5 hours, sped up. */
function flashlightProgram(sketch: p5, read: () => FlashlightFrame) {
  let time = 0;
  let wisps = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { bulb } = read();
    if (sketch.isLooping()) {
      const elapsed = sketch.deltaTime / 1000;
      time = advanceRun(time, elapsed, {
        duration: RUN_TIME,
        hold: HOLD_SECONDS,
        rate: RUN_TIME / PLAY_SECONDS,
      });
      wisps += Math.min(elapsed, 0.1);
    }
    const { height, width } = sketch;
    const table = height * 0.66;
    const wall = width * 0.82;
    const charge = Math.max(1 - time / RUN_TIME, 0);
    const lit = time < RUN_TIME;
    paintRoom(sketch, table, wall);
    const body = {
      height: height * 0.12,
      width: width * 0.24,
      x: width * 0.12,
      y: table - height * 0.14,
    };
    const lens = paintTorch(sketch, body, bulb, charge, wisps);
    if (lit) {
      paintBeam(sketch, lens, wall, bulb, lightPower(bulb) / lightPower("led"));
    }
    vignette(sketch, 0.4);
  };
}

interface FlashlightEfficiencyLabProps {
  /** The bulb in the flashlight first. */
  bulb?: Bulb;
  description: ReactNode;
  labels: {
    battery: ReactNode;
    bulbs: Record<Bulb, ReactNode>;
    chooseBulb: string;
    efficiency: ReactNode;
    heat: ReactNode;
    input: ReactNode;
    light: ReactNode;
    runTime: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A flashlight in a dark room, its cells drawn in cutaway. The battery's
 * chemical energy becomes 1 W of electrical power, and the bulb turns it into
 * light and heat. Both bulbs empty the battery in the same 7.5 h, but the LED
 * puts eight times as much of it into light.
 */
export function FlashlightEfficiencyLab({
  bulb: initialBulb = "filament",
  description,
  labels,
  title,
}: FlashlightEfficiencyLabProps) {
  const [bulb, setBulb] = useState<Bulb>(initialBulb);
  const measure = useQuantity();
  const isBulb = Schema.is(BulbSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseBulb}
          gridColumns="2"
          onValueChange={(value) => {
            if (isBulb(value)) {
              setBulb(value);
            }
          }}
          type="single"
          value={bulb}
          variant="outline"
        >
          {Arr.map(BulbSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.bulbs[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={flashlightProgram}
          state={{ bulb }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.battery}
            value={
              <InlineMath math={measure(BATTERY_ENERGY, "\\text{ J}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.input}
            value={<InlineMath math={measure(INPUT_POWER, "\\text{ W}", 0)} />}
          />
          <VisualFactIndicator
            indicatorColor={LIGHT_COLOR}
            label={labels.light}
            value={
              <InlineMath math={measure(lightPower(bulb), "\\text{ W}", 2)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={HEAT_COLOR}
            label={labels.heat}
            value={
              <InlineMath math={measure(heatPower(bulb), "\\text{ W}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.efficiency}
            value={
              <InlineMath math={measure(LIGHT_SHARE[bulb] * 100, "\\%", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.runTime}
            value={
              <InlineMath math={measure(RUN_TIME / 3600, "\\text{ h}", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
