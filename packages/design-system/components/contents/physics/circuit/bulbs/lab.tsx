import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import { vignette } from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  paintBoard,
  paintBulb,
  paintCell,
  terminal,
  wire,
} from "@repo/design-system/components/contents/physics/circuit/board";
import { bulbNetwork } from "@repo/design-system/components/contents/physics/circuit/current";
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
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** What the sketch reads on every frame. */
const BulbFrameSchema = Schema.Struct({
  broken: Schema.Boolean,
  emf: Schema.Finite,
  group: Schema.Array(Schema.Finite),
  series: Schema.Finite,
});
type BulbFrame = typeof BulbFrameSchema.Type;

/** The power at which a bulb is drawn at full brightness, a little above the brightest bulb when all of them work. */
function fullPower(frame: BulbFrame) {
  const all = bulbNetwork(
    frame.emf,
    frame.series,
    Arr.map(frame.group, (resistance) => ({ broken: false, resistance }))
  );
  const lone = bulbNetwork(
    frame.emf,
    frame.series,
    Arr.map(frame.group, (resistance, index) => ({
      broken: index > 0,
      resistance,
    }))
  );
  return (
    Math.max(...Arr.map([...all.bulbs, ...lone.bulbs], (bulb) => bulb.power)) *
    1.05
  );
}

/**
 * Draws the circuit on its board: the battery, the series bulb on the top
 * wire, and the parallel bulbs side by side on the right, each glowing with
 * its own power. The last parallel bulb is the one that can break.
 */
function bulbProgram(sketch: p5, read: () => BulbFrame) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const { height, width } = sketch;
    const at = (x: number, y: number) => ({ x: width * x, y: height * y });
    const last = frame.group.length - 1;
    const network = bulbNetwork(
      frame.emf,
      frame.series,
      Arr.map(frame.group, (resistance, index) => ({
        broken: frame.broken && index === last,
        resistance,
      }))
    );
    const full = fullPower(frame);
    paintBoard(sketch);
    const columns = Arr.map(
      frame.group,
      (_, index) => 0.56 + (index * 0.26) / Math.max(1, last)
    );
    const right = columns[last] ?? 0.88;
    wire(
      sketch,
      [at(0.12, 0.42), at(0.12, 0.18), at(0.3, 0.18)],
      MACHINE_COLORS.hullRed
    );
    wire(sketch, [at(0.42, 0.18), at(right, 0.18)], MACHINE_COLORS.hullRed);
    wire(
      sketch,
      [at(0.12, 0.62), at(0.12, 0.86), at(right, 0.86)],
      INSTRUMENT_COLORS.trolleyPaint
    );
    const size = Math.min(width, height) * 0.13;
    for (const x of columns) {
      wire(
        sketch,
        [at(x, 0.18), { x: width * x, y: height * 0.52 - size / 2 }],
        MACHINE_COLORS.hullRed
      );
      wire(
        sketch,
        [{ x: width * x, y: height * 0.52 + size * 0.7 }, at(x, 0.86)],
        INSTRUMENT_COLORS.trolleyPaint
      );
      terminal(sketch, at(x, 0.18));
      terminal(sketch, at(x, 0.86));
    }
    paintCell(sketch, at(0.12, 0.52), Math.min(width, height) * 0.26, -1, true);
    const bulbs = Arr.map(network.bulbs, (bulb) =>
      Math.sqrt(bulb.power / full)
    );
    paintBulb(sketch, at(0.36, 0.18), size, bulbs[0] ?? 0);
    Arr.forEach(columns, (x, index) => {
      paintBulb(
        sketch,
        at(x, 0.52),
        size,
        bulbs[index + 1] ?? 0,
        frame.broken && index === last
      );
    });
    const name = {
      align: "center",
      baseline: "top",
      color: getColor("WHITE"),
      size: 13,
    } as const;
    caption(
      sketch,
      "L1",
      { x: width * 0.36, y: height * 0.18 + size * 0.75 },
      name
    );
    Arr.forEach(columns, (x, index) => {
      caption(
        sketch,
        `L${index + 2}`,
        { x: width * x + size * 0.6, y: height * 0.52 - size * 0.6 },
        { ...name, align: "left" }
      );
    });
    vignette(sketch, 0.3);
  };
}

interface BulbNetworkLabProps {
  description: NonNullable<ReactNode>;
  /** The e.m.f. of the battery, which has negligible internal resistance, in volts. */
  emf: number;
  /** The resistances, in ohms, of the bulbs in parallel; the last one is the bulb that can break. */
  group: readonly [number, number, ...number[]];
  labels: {
    broken: ReactNode;
    intact: ReactNode;
    state: string;
    viewLabel: string;
  };
  /** The resistance of the bulb in series with the group, in ohms. */
  series: number;
  title: NonNullable<ReactNode>;
}

/**
 * A battery lights one bulb in series with a group of bulbs in parallel, each
 * glowing with its own power on a wooden board. Break the filament of the
 * last bulb in the group: the group's resistance rises, the battery's current
 * falls, the series bulb dims, and the bulbs left in the group take a larger
 * share of the voltage and brighten.
 */
export function BulbNetworkLab({
  description,
  emf,
  group,
  labels,
  series,
  title,
}: BulbNetworkLabProps) {
  const quantity = useQuantity();
  const [broken, setBroken] = useState(false);
  const last = group.length - 1;
  const network = bulbNetwork(
    emf,
    series,
    Arr.map(group, (resistance, index) => ({
      broken: broken && index === last,
      resistance,
    }))
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.state}
          onValueChange={(value) => setBroken(value === "broken")}
          type="single"
          value={broken ? "broken" : "intact"}
          variant="outline"
        >
          <ToggleGroupItem value="intact">{labels.intact}</ToggleGroupItem>
          <ToggleGroupItem value="broken">{labels.broken}</ToggleGroupItem>
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={bulbProgram}
          state={{ broken, emf, group, series }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          {Arr.map(
            Arr.map(network.bulbs, (bulb, index) => ({
              ...bulb,
              name: `L_{${index + 1}}`,
            })),
            (bulb) => (
              <VisualFactTabular
                key={bulb.name}
                label={<InlineMath math={bulb.name} />}
                value={
                  <InlineMath
                    math={`${quantity(bulb.voltage, "\\text{ V}", 2)},\\ ${quantity(bulb.power, "\\text{ W}", 2)}`}
                  />
                }
              />
            )
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
