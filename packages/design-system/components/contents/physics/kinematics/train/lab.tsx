import {
  arrow,
  fade,
  gradientRect,
  mix,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  paintLandscape,
  paintPerson,
  type Road,
} from "@repo/design-system/components/contents/physics/canvas/scene";
import {
  type Observer,
  ObserverSchema,
  passengerVelocity,
  trainVelocity,
  type WalkWay,
  WalkWaySchema,
} from "@repo/design-system/components/contents/physics/kinematics/train/carriage";
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
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** A commuter train and a walking pace, in m/s (72 km/h and an easy walk). */
const TRAIN = 20;
const WALK = 1.5;

/** The carriage length and the metres of scene the canvas spans, in metres. */
const CARRIAGE = 20;
const SPAN = 32;

/** The scene plays at a quarter of real speed, so the walk can be seen beside the train. */
const PLAY_RATE = 0.25;

/** What the sketch reads on every frame. */
const TrainFrameSchema = Schema.Struct({
  observer: ObserverSchema,
  way: WalkWaySchema,
});
type TrainFrame = typeof TrainFrameSchema.Type;

/** The platform's pillars, every 8 m, scrolling past when seen from the train. */
function paintPlatform(sketch: p5, road: Road, shift: number) {
  const top = road.surface + road.height * 0.04;
  gradientRect(
    sketch,
    { height: sketch.height - top, width: sketch.width, x: 0, y: top },
    [
      [0, MATERIAL.pavement],
      [1, mix(MATERIAL.pavement, getColor("BLACK"), 0.4)],
    ]
  );
  sketch.noStroke();
  sketch.fill(MATERIAL.roadPaint);
  sketch.rect(0, top, sketch.width, road.height * 0.015);
  const gap = 8 * road.scale;
  const offset = (((shift * road.scale) % gap) + gap) % gap;
  for (let x = -offset; x < sketch.width + gap; x += gap) {
    withShadow(
      sketch,
      { blur: 8, color: fade(getColor("BLACK"), 0.5), drop: 3 },
      () => {
        gradientRect(
          sketch,
          {
            height: road.height * 0.5,
            width: road.scale * 0.5,
            x,
            y: top + road.height * 0.04,
          },
          [
            [0, mix(MATERIAL.kerb, getColor("WHITE"), 0.3)],
            [1, MATERIAL.kerb],
          ],
          true
        );
      }
    );
  }
}

/** One carriage: silver body, a band of windows, doors, and bogies on the rail. */
function paintCarriage(sketch: p5, road: Road, left: number) {
  const length = CARRIAGE * road.scale;
  const tall = road.height * 0.42;
  const bottom = road.surface - road.height * 0.03;
  withShadow(
    sketch,
    { blur: 14, color: fade(getColor("BLACK"), 0.5), drop: 5 },
    () => {
      gradientRect(
        sketch,
        { height: tall, width: length, x: left, y: bottom - tall },
        [
          [0, mix(MATERIAL.chrome, getColor("WHITE"), 0.3)],
          [0.55, MATERIAL.chrome],
          [1, mix(MATERIAL.chrome, getColor("BLACK"), 0.35)],
        ]
      );
    }
  );
  sketch.noStroke();
  sketch.fill(PLOT_COLORS.pink);
  sketch.rect(left, bottom - tall * 0.3, length, tall * 0.06);
  sketch.fill(mix(MATERIAL.tintedGlass, MATERIAL.skyHaze, 0.3));
  sketch.rect(
    left + length * 0.03,
    bottom - tall * 0.82,
    length * 0.94,
    tall * 0.36,
    4
  );
  sketch.fill(getColor("ZINC", 900));
  for (const at of [0.12, 0.88]) {
    sketch.rect(
      left + length * at - road.scale * 1.2,
      bottom,
      road.scale * 2.4,
      road.height * 0.04,
      2
    );
  }
}

/**
 * Draws the scene as one observer sees it. From the platform the carriage
 * sweeps past and the walker inside moves with it plus the walk; from a seat
 * in the train the carriage stands still and the platform slides backward,
 * while the walker just walks.
 */
function trainProgram(sketch: p5, read: () => TrainFrame) {
  let clock = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { observer, way } = read();
    if (sketch.isLooping()) {
      clock += Math.min(sketch.deltaTime / 1000, 0.1) * PLAY_RATE;
    }
    const road: Road = {
      height: sketch.height * 0.62,
      origin: 0,
      scale: sketch.width / SPAN,
      surface: sketch.height * 0.62,
      top: 0,
    };
    paintLandscape(sketch, road);
    const cycle = (SPAN + CARRIAGE) / TRAIN;
    const ride = observer === "train" ? 0 : (clock % cycle) * TRAIN - CARRIAGE;
    paintPlatform(sketch, road, observer === "train" ? clock * TRAIN : 0);
    const left =
      observer === "train"
        ? ((SPAN - CARRIAGE) / 2) * road.scale
        : ride * road.scale;
    for (let car = -3; car <= 3; car += 1) {
      paintCarriage(sketch, road, left + car * (CARRIAGE + 1) * road.scale);
    }
    const walked = (clock * WALK) % (CARRIAGE * 0.8);
    const inside =
      way === "forward" ? CARRIAGE * 0.1 + walked : CARRIAGE * 0.9 - walked;
    const person = {
      x: left + inside * road.scale,
      y: road.surface - road.height * 0.08,
    };
    paintPerson(sketch, person, road.height * 0.27, PLOT_COLORS.teal);
    const unit = road.scale * 0.6;
    const own = passengerVelocity(TRAIN, WALK, way, observer);
    arrow(
      sketch,
      { x: person.x, y: road.height * 0.12 },
      { x: person.x + own * unit, y: road.height * 0.12 },
      { color: PLOT_COLORS.teal, head: 12, weight: 4 }
    );
    const carriage = trainVelocity(TRAIN, observer);
    if (carriage > 0) {
      arrow(
        sketch,
        { x: left + CARRIAGE * road.scale * 0.5, y: road.height * 0.2 },
        {
          x: left + CARRIAGE * road.scale * 0.5 + carriage * unit,
          y: road.height * 0.2,
        },
        { color: PLOT_COLORS.pink, head: 12, weight: 4 }
      );
    }
    vignette(sketch, 0.3);
  };
}

interface TrainPassengerRelativeLabProps {
  description: ReactNode;
  labels: {
    chooseObserver: string;
    chooseWay: string;
    observers: Record<Observer, ReactNode>;
    passenger: ReactNode;
    train: ReactNode;
    viewLabel: string;
    walk: ReactNode;
    ways: Record<WalkWay, ReactNode>;
  };
  title: ReactNode;
}

/**
 * A passenger walks along a commuter carriage moving at 20 m/s. Watched
 * from the platform, the passenger moves at 21.5 m/s walking forward and at
 * 18.5 m/s walking back; watched from a seat inside, at just 1.5 m/s either
 * way, while the platform slides backward at 20 m/s.
 */
export function TrainPassengerRelativeLab({
  description,
  labels,
  title,
}: TrainPassengerRelativeLabProps) {
  const [observer, setObserver] = useState<Observer>("platform");
  const [way, setWay] = useState<WalkWay>("forward");
  const quantity = useQuantity();
  const isObserver = Schema.is(ObserverSchema);
  const isWay = Schema.is(WalkWaySchema);
  const signed = (value: number) =>
    `${value > 0 ? "+" : ""}${quantity(value, "\\text{ m/s}", 1)}`;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseObserver}
          gridColumns="2"
          onValueChange={(value) => {
            if (isObserver(value)) {
              setObserver(value);
            }
          }}
          type="single"
          value={observer}
          variant="outline"
        >
          <ToggleGroupItem value="platform">
            {labels.observers.platform}
          </ToggleGroupItem>
          <ToggleGroupItem value="train">
            {labels.observers.train}
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          aria-label={labels.chooseWay}
          gridColumns="2"
          onValueChange={(value) => {
            if (isWay(value)) {
              setWay(value);
            }
          }}
          type="single"
          value={way}
          variant="outline"
        >
          <ToggleGroupItem value="forward">
            {labels.ways.forward}
          </ToggleGroupItem>
          <ToggleGroupItem value="backward">
            {labels.ways.backward}
          </ToggleGroupItem>
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={trainProgram}
          state={{ observer, way }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.train}
            value={<InlineMath math={signed(trainVelocity(TRAIN, observer))} />}
          />
          <VisualFactTabular
            label={labels.walk}
            value={
              <InlineMath math={signed(way === "forward" ? WALK : -WALK)} />
            }
          />
          <VisualFactTabular
            label={labels.passenger}
            value={
              <InlineMath
                math={signed(passengerVelocity(TRAIN, WALK, way, observer))}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
