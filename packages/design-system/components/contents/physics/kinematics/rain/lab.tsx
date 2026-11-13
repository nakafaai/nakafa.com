import {
  arrow,
  createBackdrop,
  fade,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  paintCar,
  paintLandscape,
  paintRoad,
  type Road,
} from "@repo/design-system/components/contents/physics/canvas/scene";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { apparentRain } from "@repo/design-system/components/contents/physics/kinematics/rain/drops";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
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

/** The two observers a learner can watch the rain from. */
const FrameSchema = Schema.Literals(["ground", "car"]);
type Frame = typeof FrameSchema.Type;

/** How many drops fall in view, and the metres of scene the canvas spans across. */
const DROPS = 160;
const SPAN = 24;

/** What the sketch reads on every frame. */
const RainFrameSchema = Schema.Struct({
  car: Schema.Finite,
  frame: FrameSchema,
  rain: Schema.Finite,
});
type RainFrame = typeof RainFrameSchema.Type;

/** The road band, its metres mapped so the car stands in the middle. */
function rainRoad(sketch: p5): Road {
  return {
    height: sketch.height * 0.62,
    origin: sketch.width * 0.5,
    scale: sketch.width / SPAN,
    surface: sketch.height * 0.62,
    top: 0,
  };
}

/**
 * Draws the rain as one observer sees it. From the ground the drops fall
 * straight and the car drives through them; from the car the car stands
 * still and the drops come at it on a slant. The velocity triangle sits in
 * the corner: rain down, the car's velocity reversed, and their sum.
 */
function rainProgram(sketch: p5, read: () => RainFrame) {
  let clock = 0;
  const backdrop = createBackdrop();
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { car, frame, rain } = read();
    if (sketch.isLooping()) {
      clock += Math.min(sketch.deltaTime / 1000, 0.1) * 0.35;
    }
    const road = rainRoad(sketch);
    backdrop(sketch, "rain", (layer) => {
      paintLandscape(layer, road);
      paintRoad(layer, road, { length: SPAN, start: -SPAN, step: 4 });
    });
    sketch.fill(fade(MATERIAL.skyHaze, 0.25));
    sketch.noStroke();
    sketch.rect(0, 0, sketch.width, road.surface);
    const carLength = sketch.width * 0.22;
    const drift = frame === "car" ? car : 0;
    const carShift = frame === "car" ? 0 : ((clock * car) % SPAN) * road.scale;
    const rear =
      road.origin -
      carLength / 2 +
      carShift -
      (carShift > sketch.width / 2 + carLength ? sketch.width + carLength : 0);
    paintCar(sketch, road, {
      color: PLOT_COLORS.teal,
      length: carLength,
      rear,
    });
    const fall = road.surface * 1.1;
    sketch.stroke(fade(MATERIAL.waterGlint, 0.75));
    sketch.strokeWeight(1.4);
    const streak = 0.05;
    for (let index = 0; index < DROPS; index += 1) {
      const x0 = hashUnit(index, 1) * (sketch.width + fall) - fall * 0.5;
      const y =
        ((hashUnit(index, 2) * fall + clock * rain * road.scale) % fall) -
        fall * 0.05;
      const x =
        ((((x0 - drift * road.scale * clock) % (sketch.width + fall)) +
          sketch.width +
          fall) %
          (sketch.width + fall)) -
        fall * 0.25;
      sketch.line(
        x,
        y,
        x + drift * road.scale * streak,
        y - rain * road.scale * streak
      );
    }
    sketch.noStroke();
    const unit = sketch.height * 0.022;
    const corner = { x: sketch.width * 0.86, y: sketch.height * 0.1 };
    const down = { x: corner.x, y: corner.y + rain * unit };
    arrow(sketch, corner, down, {
      color: PLOT_COLORS.violet,
      head: 10,
      weight: 3,
    });
    if (frame === "car" && car > 0) {
      const back = { x: down.x - car * unit, y: down.y };
      arrow(sketch, down, back, {
        color: PLOT_COLORS.amber,
        head: 10,
        weight: 3,
      });
      arrow(sketch, corner, back, {
        color: getColor("WHITE"),
        head: 10,
        weight: 3,
      });
    }
    vignette(sketch, 0.3);
  };
}

interface RainDriveRelativeVelocityLabProps {
  /** The car's speed the card starts at, in m/s. */
  car?: number;
  description: ReactNode;
  labels: {
    angle: ReactNode;
    apparentSpeed: ReactNode;
    carSpeed: ReactNode;
    carSpeedName: string;
    chooseFrame: string;
    frames: Record<Frame, ReactNode>;
    rainSpeed: ReactNode;
    viewLabel: string;
  };
  /** How fast the rain falls, in m/s. */
  rain?: number;
  title: ReactNode;
}

/**
 * Rain falling straight down on a still day, watched from the roadside or
 * from inside a moving car. The faster the car, the more the rain slants
 * toward the windscreen and the faster it seems to come: its velocity
 * relative to the car is its own velocity minus the car's.
 */
export function RainDriveRelativeVelocityLab({
  car: initialCar = 10,
  description,
  labels,
  rain = 6.5,
  title,
}: RainDriveRelativeVelocityLabProps) {
  const [car, setCar] = useState(initialCar);
  const [frame, setFrame] = useState<Frame>("car");
  const quantity = useQuantity();
  const seen = apparentRain(rain, frame === "car" ? car : 0);
  const isFrame = Schema.is(FrameSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseFrame}
          gridColumns="2"
          onValueChange={(value) => {
            if (isFrame(value)) {
              setFrame(value);
            }
          }}
          type="single"
          value={frame}
          variant="outline"
        >
          <ToggleGroupItem value="ground">
            {labels.frames.ground}
          </ToggleGroupItem>
          <ToggleGroupItem value="car">{labels.frames.car}</ToggleGroupItem>
        </ToggleGroup>
        <LabSlider
          label={labels.carSpeed}
          max={25}
          min={0}
          name={labels.carSpeedName}
          onValueChange={setCar}
          readout={<InlineMath math={quantity(car, "\\text{ m/s}", 0)} />}
          step={1}
          value={car}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={rainProgram}
          state={{ car, frame, rain }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.rainSpeed}
            value={<InlineMath math={quantity(rain, "\\text{ m/s}", 1)} />}
          />
          <VisualFactTabular
            label={labels.apparentSpeed}
            value={
              <InlineMath math={quantity(seen.speed, "\\text{ m/s}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.angle}
            value={<InlineMath math={quantity(seen.angle, "^\\circ", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
