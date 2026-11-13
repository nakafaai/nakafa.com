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
  BOILING_POINT,
  boilTime,
  ELEMENT_POWER,
  FILL_MASS,
  type Fill,
  FillSchema,
  heatNeeded,
  START_TEMPERATURE,
  TEMPERATURE_RISE,
  waterTemperature,
} from "@repo/design-system/components/contents/physics/renewable-energy/kettle/heating";
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
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How many wall seconds the heating plays in, sped up from minutes. */
const PLAY_SECONDS = 7;

/** How long the boiling kettle rests before the run starts again, in wall seconds. */
const HOLD_SECONDS = 2;

/** The cold and the hot tone of the water. */
const COLD_WATER = MATERIAL.kettleWater;
const HOT_WATER = MATERIAL.warmWater;

/** What the sketch reads on every frame: how full the kettle is. */
const KettleFrameSchema = Schema.Struct({ fill: FillSchema });
type KettleFrame = typeof KettleFrameSchema.Type;

/** The kitchen wall, the counter top and the light from a window on the left. */
function paintKitchen(sketch: p5, counter: number) {
  const { height, width } = sketch;
  gradientRect(sketch, { height: counter, width, x: 0, y: 0 }, [
    [0, mix(getColor("SLATE", 200), getColor("STONE", 600), 0.45)],
    [1, mix(getColor("SLATE", 200), getColor("STONE", 600), 0.25)],
  ]);
  spotlight(sketch, { x: width * 0.12, y: counter * 0.3 }, width * 0.6, {
    color: MATERIAL.sunDisc,
    strength: 0.4,
  });
  gradientRect(sketch, { height: height - counter, width, x: 0, y: counter }, [
    [0, mix(getColor("STONE", 600), getColor("WHITE"), 0.35)],
    [0.12, getColor("STONE", 600)],
    [1, mix(getColor("STONE", 600), getColor("BLACK"), 0.55)],
  ]);
}

/** The glass kettle on its base: its water, the bubbles that rise as it heats, and the steam at the boil. */
function paintKettle(
  sketch: p5,
  counter: number,
  fill: Fill,
  temperature: number,
  time: number
) {
  const { height, width } = sketch;
  const body = {
    height: height * 0.52,
    width: Math.min(width * 0.26, height * 0.42),
    x: width * 0.3,
    y: counter - height * 0.6,
  };
  const base = height * 0.06;
  const warm = (temperature - START_TEMPERATURE) / TEMPERATURE_RISE;
  withShadow(
    sketch,
    { blur: 18, color: fade(getColor("BLACK"), 0.55), drop: 8 },
    () => {
      gradientRect(
        sketch,
        {
          height: base,
          width: body.width * 1.1,
          x: body.x - body.width * 0.05,
          y: counter - base,
        },
        [
          [0, getColor("ZINC", 900)],
          [1, getColor("ZINC", 950)],
        ]
      );
    }
  );
  sketch.fill(fade(MATERIAL.coalGlow, 0.3 + 0.6 * Math.min(warm * 3, 1)));
  sketch.rect(
    body.x + body.width * 0.1,
    counter - base - 3,
    body.width * 0.8,
    3
  );
  const bottom = counter - base - 3;
  sketch.fill(fade(getColor("SLATE", 200), 0.22));
  sketch.rect(body.x, body.y, body.width, bottom - body.y, 10, 10, 4, 4);
  const level = (FILL_MASS[fill] / 1.7) * (bottom - body.y);
  gradientRect(
    sketch,
    { height: level, width: body.width - 6, x: body.x + 3, y: bottom - level },
    [
      [0, fade(mix(COLD_WATER, HOT_WATER, warm), 0.75)],
      [
        1,
        fade(
          mix(mix(COLD_WATER, HOT_WATER, warm), getColor("BLACK"), 0.25),
          0.9
        ),
      ],
    ]
  );
  const bubbles = Math.round(warm * warm * 26);
  sketch.fill(fade(getColor("WHITE"), 0.65));
  for (let bubble = 0; bubble < bubbles; bubble += 1) {
    const seed = Math.sin(bubble * 12.9898) * 43_758.5453;
    const column = seed - Math.floor(seed);
    const rise = (time * (0.6 + column) + column * 7) % 1;
    sketch.circle(
      body.x + 8 + column * (body.width - 16),
      bottom - rise * level,
      2 + column * 3
    );
  }
  sketch.stroke(fade(getColor("WHITE"), 0.55));
  sketch.strokeWeight(2);
  sketch.noFill();
  sketch.rect(body.x, body.y, body.width, bottom - body.y, 10, 10, 4, 4);
  sketch.strokeWeight(6);
  sketch.stroke(getColor("ZINC", 900));
  sketch.arc(
    body.x + body.width,
    body.y + (bottom - body.y) * 0.45,
    body.width * 0.5,
    (bottom - body.y) * 0.6,
    -Math.PI / 2,
    Math.PI / 2
  );
  sketch.noStroke();
  if (temperature >= BOILING_POINT - 0.5) {
    for (let puff = 0; puff < 6; puff += 1) {
      const rise = (time * 0.35 + puff / 6) % 1;
      sketch.fill(fade(getColor("WHITE"), 0.45 * (1 - rise)));
      sketch.circle(
        body.x + body.width * 0.2 + Math.sin(puff + time) * 8,
        body.y - rise * height * 0.3,
        14 + rise * 30
      );
    }
  }
  return body;
}

/** A thermometer beside the kettle, filled from 0 °C to 100 °C. */
function paintThermometer(sketch: p5, counter: number, temperature: number) {
  const { height, width } = sketch;
  const x = width * 0.72;
  const top = counter - height * 0.62;
  const span = height * 0.5;
  const tube = Math.max(width * 0.018, 9);
  withShadow(
    sketch,
    { blur: 10, color: fade(getColor("BLACK"), 0.4), drop: 4 },
    () => {
      sketch.fill(fade(getColor("WHITE"), 0.85));
      sketch.rect(x - tube, top - tube, tube * 2, span + tube * 2, tube);
      sketch.circle(x, top + span + tube, tube * 3.2);
    }
  );
  const filled = (temperature / BOILING_POINT) * span;
  sketch.fill(MATERIAL.calx);
  sketch.rect(x - tube * 0.4, top + span - filled, tube * 0.8, filled + tube);
  sketch.circle(x, top + span + tube, tube * 2.2);
  sketch.stroke(fade(getColor("NEUTRAL", 800), 0.6));
  sketch.strokeWeight(1);
  for (let mark = 0; mark <= 10; mark += 1) {
    const y = top + span - (mark / 10) * span;
    sketch.line(x + tube, y, x + tube + (mark % 5 === 0 ? 9 : 5), y);
  }
  sketch.noStroke();
}

/**
 * Draws one moment of the heating, sped up from minutes to seconds: the
 * water warms at the rate the element delivers energy, then boils and steams.
 */
function kettleProgram(sketch: p5, read: () => KettleFrame) {
  let time = 0;
  let bubbles = 0;
  let shown: Fill | undefined;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { fill } = read();
    const duration = boilTime(fill);
    if (shown !== fill) {
      shown = fill;
      time = sketch.isLooping() ? 0 : duration * 0.6;
    }
    if (sketch.isLooping()) {
      const elapsed = sketch.deltaTime / 1000;
      time = advanceRun(time, elapsed, {
        duration,
        hold: HOLD_SECONDS,
        rate: duration / PLAY_SECONDS,
      });
      bubbles += Math.min(elapsed, 0.1);
    }
    const temperature = waterTemperature(fill, shownTime(time, duration));
    const counter = sketch.height * 0.8;
    paintKitchen(sketch, counter);
    paintKettle(sketch, counter, fill, temperature, bubbles);
    paintThermometer(sketch, counter, temperature);
    vignette(sketch, 0.3);
  };
}

interface KettleHeatingLabProps {
  description: ReactNode;
  /** How full the kettle starts. */
  fill?: Fill;
  labels: {
    chooseFill: string;
    energy: ReactNode;
    power: ReactNode;
    rise: ReactNode;
    time: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * An electric kettle boils 0.5 kg, 1 kg or 1.5 kg of water from 25 °C.
 * Electrical work crosses into the kettle and the water stores it as
 * internal energy, Q = m c ΔT, so twice the water needs twice the energy and,
 * at the same 2100 W, twice the time.
 */
export function KettleHeatingLab({
  description,
  fill: initialFill = "full",
  labels,
  title,
}: KettleHeatingLabProps) {
  const [fill, setFill] = useState<Fill>(initialFill);
  const measure = useQuantity();
  const isFill = Schema.is(FillSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseFill}
          gridColumns="3"
          onValueChange={(value) => {
            if (isFill(value)) {
              setFill(value);
            }
          }}
          type="single"
          value={fill}
          variant="outline"
        >
          {Arr.map(FillSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              <InlineMath math={measure(FILL_MASS[option], "\\text{ kg}", 1)} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={kettleProgram}
          state={{ fill }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath math={measure(ELEMENT_POWER, "\\text{ W}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.rise}
            value={
              <InlineMath math={measure(TEMPERATURE_RISE, "\\text{ K}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.energy}
            value={
              <InlineMath math={measure(heatNeeded(fill), "\\text{ J}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.time}
            value={
              <InlineMath math={measure(boilTime(fill), "\\text{ s}", 0)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
