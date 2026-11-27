import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  dashed,
  fade,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  paintBoard,
  paintCell,
  paintMeter,
  paintResistor,
  terminal,
  wire,
} from "@repo/design-system/components/contents/physics/circuit/board";
import {
  cellFromReadings,
  drive,
} from "@repo/design-system/components/contents/physics/circuit/current";
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
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";
import { useState } from "react";

/** What the sketch reads on every frame. */
const CellFrameSchema = Schema.Struct({
  emf: Schema.Finite,
  internal: Schema.Finite,
  options: Schema.Array(Schema.Finite),
  resistance: Schema.Finite,
});
type CellFrame = typeof CellFrameSchema.Type;

/** The circuit across the top half: the cell inside its dashed internal-resistance box, the voltmeter across it, and the resistor. */
function paintCircuit(sketch: p5, frame: CellFrame) {
  const { height, width } = sketch;
  const at = (x: number, y: number) => ({ x: width * x, y: height * y });
  const { voltage } = drive(frame, frame.resistance);
  wire(
    sketch,
    [at(0.16, 0.33), at(0.16, 0.48), at(0.42, 0.48)],
    INSTRUMENT_COLORS.trolleyPaint
  );
  wire(
    sketch,
    [at(0.62, 0.48), at(0.86, 0.48), at(0.86, 0.33), at(0.44, 0.33)],
    MACHINE_COLORS.hullRed
  );
  wire(
    sketch,
    [at(0.16, 0.33), at(0.16, 0.13), at(0.24, 0.13)],
    INSTRUMENT_COLORS.trolleyPaint
  );
  wire(
    sketch,
    [at(0.36, 0.13), at(0.44, 0.13), at(0.44, 0.33)],
    MACHINE_COLORS.hullRed
  );
  paintResistor(sketch, at(0.42, 0.48), at(0.62, 0.48), width * 0.16);
  paintCell(sketch, at(0.3, 0.33), width * 0.2, 1);
  dashed(sketch, at(0.18, 0.26), at(0.42, 0.26), {
    color: fade(getColor("WHITE"), 0.75),
    dash: 5,
    weight: 1.5,
  });
  dashed(sketch, at(0.18, 0.4), at(0.42, 0.4), {
    color: fade(getColor("WHITE"), 0.75),
    dash: 5,
    weight: 1.5,
  });
  dashed(sketch, at(0.18, 0.26), at(0.18, 0.4), {
    color: fade(getColor("WHITE"), 0.75),
    dash: 5,
    weight: 1.5,
  });
  dashed(sketch, at(0.42, 0.26), at(0.42, 0.4), {
    color: fade(getColor("WHITE"), 0.75),
    dash: 5,
    weight: 1.5,
  });
  for (const point of [at(0.16, 0.33), at(0.44, 0.33)]) {
    terminal(sketch, point);
  }
  paintMeter(sketch, at(0.3, 0.13), Math.min(width, height) * 0.16, {
    full: Math.ceil(frame.emf),
    letter: "V",
    value: voltage,
  });
  caption(
    sketch,
    "E, r",
    { x: width * 0.3, y: height * 0.41 },
    {
      align: "center",
      baseline: "top",
      color: fade(getColor("WHITE"), 0.9),
      size: 13,
    }
  );
}

/**
 * The terminal voltage against the current in the lower half: the cell's
 * line V = E − I r through every reading, the dashed line V = I R of the
 * chosen resistor, and the point where they meet, which the circuit shows.
 */
function paintGraph(sketch: p5, frame: CellFrame) {
  const { height, width } = sketch;
  const box = {
    bottom: height * 0.93,
    left: width * 0.14,
    right: width * 0.92,
    top: height * 0.58,
  };
  const most =
    Math.max(
      ...Arr.map(
        frame.options,
        (resistance) => drive(frame, resistance).current
      )
    ) * 1.25;
  const x = (current: number) =>
    box.left + (current / most) * (box.right - box.left);
  const y = (voltage: number) =>
    box.bottom - (voltage / (frame.emf * 1.15)) * (box.bottom - box.top);
  sketch.noStroke();
  sketch.fill(fade(getColor("ZINC", 950), 0.72));
  sketch.rect(
    box.left - width * 0.08,
    box.top - height * 0.03,
    box.right - box.left + width * 0.11,
    box.bottom - box.top + height * 0.06,
    8
  );
  sketch.stroke(fade(getColor("WHITE"), 0.7));
  sketch.strokeWeight(1.5);
  sketch.line(box.left, box.bottom, box.right, box.bottom);
  sketch.line(box.left, box.bottom, box.left, box.top);
  sketch.stroke(PLOT_COLORS.teal);
  sketch.strokeWeight(2.5);
  const end = Math.min(most, frame.emf / frame.internal);
  sketch.line(x(0), y(frame.emf), x(end), y(frame.emf - end * frame.internal));
  const chosen = drive(frame, frame.resistance);
  dashed(
    sketch,
    { x: x(0), y: y(0) },
    {
      x: x(Math.min(most, (frame.emf * 1.1) / frame.resistance)),
      y: y(Math.min(most * frame.resistance, frame.emf * 1.1)),
    },
    {
      color: fade(PLOT_COLORS.amber, 0.9),
      dash: 5,
      weight: 1.5,
    }
  );
  sketch.noStroke();
  for (const resistance of frame.options) {
    const point = drive(frame, resistance);
    sketch.fill(
      resistance === frame.resistance
        ? PLOT_COLORS.amber
        : fade(getColor("WHITE"), 0.8)
    );
    sketch.circle(
      x(point.current),
      y(point.voltage),
      resistance === frame.resistance ? 11 : 7
    );
  }
  sketch.fill(PLOT_COLORS.teal);
  sketch.circle(x(0), y(frame.emf), 8);
  dashed(
    sketch,
    { x: x(chosen.current), y: y(chosen.voltage) },
    { x: x(chosen.current), y: box.bottom },
    {
      color: fade(PLOT_COLORS.amber, 0.6),
      dash: 3,
      weight: 1,
    }
  );
  const axis = { color: fade(getColor("WHITE"), 0.85), size: 12 } as const;
  caption(
    sketch,
    "V",
    { x: box.left - 8, y: box.top + 6 },
    { ...axis, align: "right", baseline: "middle" }
  );
  caption(
    sketch,
    "I",
    { x: box.right - 6, y: box.bottom + 6 },
    { ...axis, align: "center", baseline: "top" }
  );
}

/** Draws the board, the circuit and its graph. */
function cellProgram(sketch: p5, read: () => CellFrame) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    paintBoard(sketch);
    paintCircuit(sketch, frame);
    paintGraph(sketch, frame);
    vignette(sketch, 0.3);
  };
}

interface InternalResistanceLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    current: ReactNode;
    emf: ReactNode;
    internal: ReactNode;
    resistor: string;
    terminal: ReactNode;
    viewLabel: string;
  };
  /** Two or more measured readings: each external resistance in ohms and the terminal voltage in volts. */
  readings: readonly [
    { readonly resistance: number; readonly voltage: number },
    { readonly resistance: number; readonly voltage: number },
    ...{ readonly resistance: number; readonly voltage: number }[],
  ];
  title: NonNullable<ReactNode>;
  /** A further resistance, in ohms, whose current the readings let you predict. */
  trial: number;
}

/**
 * A dry cell with a voltmeter across its terminals drives one resistor at a
 * time. Two readings fix the cell's e.m.f. and internal resistance: they lie
 * on the line V = E − I r. Swap the resistor and watch the operating point
 * slide along that line to where the resistor's own line V = I R meets it.
 */
export function InternalResistanceLab({
  description,
  labels,
  readings,
  title,
  trial,
}: InternalResistanceLabProps) {
  const quantity = useQuantity();
  const cell = cellFromReadings(readings[0], readings[1]);
  const options = Arr.dedupe([
    ...Arr.map(readings, (reading) => reading.resistance),
    trial,
  ]);
  const [resistance, setResistance] = useState(readings[0].resistance);
  const now = drive(cell, resistance);

  return (
    <VisualCard
      onReset={() => {
        setResistance(readings[0].resistance);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.resistor}
          onValueChange={(value) => setResistance(Number(value))}
          type="single"
          value={String(resistance)}
          variant="outline"
        >
          {Arr.map(options, (option) => (
            <ToggleGroupItem key={option} value={String(option)}>
              <InlineMath math={`R=${quantity(option, "\\,\\Omega", 1)}`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={cellProgram}
          state={{ ...cell, options, resistance }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.current}
            value={<InlineMath math={quantity(now.current, "\\text{ A}", 2)} />}
          />
          <VisualFactTabular
            label={labels.terminal}
            value={<InlineMath math={quantity(now.voltage, "\\text{ V}", 2)} />}
          />
          <VisualFactTabular
            label={labels.emf}
            value={<InlineMath math={quantity(cell.emf, "\\text{ V}", 2)} />}
          />
          <VisualFactTabular
            label={labels.internal}
            value={
              <InlineMath math={quantity(cell.internal, "\\,\\Omega", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
