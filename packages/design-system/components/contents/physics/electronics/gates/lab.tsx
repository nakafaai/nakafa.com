import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  paintBoard,
  wire,
} from "@repo/design-system/components/contents/physics/circuit/board";
import {
  type Gate,
  GateSchema,
  gateOutput,
} from "@repo/design-system/components/contents/physics/electronics/logic";
import {
  paintChip,
  paintLed,
} from "@repo/design-system/components/contents/physics/electronics/parts";
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

/** Wall seconds the trainer spends on each row of the table. */
const ROW_SECONDS = 1.6;

/** One row of the given truth table: the inputs A, B and C, and the output Q the circuit gave. */
const RowSchema = Schema.Struct({
  a: Schema.Finite,
  b: Schema.Finite,
  c: Schema.Finite,
  q: Schema.Finite,
});
type Row = typeof RowSchema.Type;

/** What the sketch reads on every frame. */
const GatesFrameSchema = Schema.Struct({
  gate: GateSchema,
  rows: Schema.Array(RowSchema),
});
type GatesFrame = typeof GatesFrameSchema.Type;

/** The circuit's output for one row with gate P: X from P, then Q from the NAND gate of X and C. */
function evaluate(gate: Gate, row: Row) {
  const x = gateOutput(gate, row.a, row.b);
  return { q: gateOutput("NAND", x, row.c), x };
}

/**
 * Draws one moment on a logic trainer: the input lights A, B and C set to
 * the row being tried, gate P and the NAND chip with the wires between them,
 * the lights X and Q, and below them the given table with each row ticked
 * where gate P reproduces its Q and crossed where it does not.
 */
function gatesProgram(sketch: p5, read: () => GatesFrame) {
  let clock = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      clock += Math.min(sketch.deltaTime / 1000, 0.1);
    }
    const { height, width } = sketch;
    paintBoard(sketch);
    const index =
      Math.floor(clock / ROW_SECONDS) % Math.max(frame.rows.length, 1);
    const row = frame.rows[index];
    if (row === undefined) {
      return;
    }
    const result = evaluate(frame.gate, row);
    const at = (x: number, y: number) => ({ x: width * x, y: height * y });
    const led = Math.min(width, height) * 0.05;
    wire(
      sketch,
      [at(0.1, 0.14), at(0.3, 0.14), at(0.3, 0.2)],
      MATERIAL.hullRed
    );
    wire(
      sketch,
      [at(0.1, 0.32), at(0.3, 0.32), at(0.3, 0.28)],
      MATERIAL.hullRed
    );
    wire(sketch, [at(0.44, 0.23), at(0.6, 0.23)], MATERIAL.signalAmber);
    wire(
      sketch,
      [at(0.1, 0.44), at(0.66, 0.44), at(0.66, 0.31)],
      MATERIAL.hullRed
    );
    wire(sketch, [at(0.8, 0.27), at(0.9, 0.27)], MATERIAL.signalGreen);
    paintChip(
      sketch,
      {
        height: height * 0.12,
        width: width * 0.16,
        x: width * 0.28,
        y: height * 0.17,
      },
      frame.gate
    );
    paintChip(
      sketch,
      {
        height: height * 0.12,
        width: width * 0.16,
        x: width * 0.62,
        y: height * 0.21,
      },
      "NAND"
    );
    const name = {
      align: "right",
      baseline: "middle",
      color: getColor("WHITE"),
      size: 13,
    } as const;
    Arr.forEach(
      [
        { label: "A", on: row.a === 1, y: 0.14 },
        { label: "B", on: row.b === 1, y: 0.32 },
        { label: "C", on: row.c === 1, y: 0.44 },
      ],
      (input) => {
        paintLed(sketch, at(0.1, input.y), led, input.on, MATERIAL.signalRed);
        caption(
          sketch,
          input.label,
          { x: width * 0.1 - led, y: height * input.y },
          name
        );
      }
    );
    paintLed(
      sketch,
      at(0.52, 0.23),
      led * 0.8,
      result.x === 1,
      MATERIAL.signalAmber
    );
    caption(
      sketch,
      "X",
      { x: width * 0.52, y: height * 0.23 - led },
      { ...name, align: "center", baseline: "bottom" }
    );
    paintLed(sketch, at(0.92, 0.27), led, result.q === 1, MATERIAL.signalGreen);
    caption(
      sketch,
      "Q",
      { x: width * 0.92, y: height * 0.27 - led },
      { ...name, align: "center", baseline: "bottom" }
    );
    const table = {
      left: width * 0.08,
      right: width * 0.92,
      top: height * 0.54,
    };
    const rowHeight = Math.min(
      height * 0.07,
      (height * 0.42) / (frame.rows.length + 1)
    );
    const columns = ["A", "B", "C", "X", "Q", ""];
    const columnX = (column: number) =>
      table.left +
      ((table.right - table.left) * (column + 0.5)) / columns.length;
    sketch.noStroke();
    sketch.fill(fade(getColor("ZINC", 950), 0.75));
    sketch.rect(
      table.left,
      table.top,
      table.right - table.left,
      rowHeight * (frame.rows.length + 1),
      6
    );
    Arr.forEach(columns, (heading, column) => {
      caption(
        sketch,
        heading,
        { x: columnX(column), y: table.top + rowHeight / 2 },
        {
          align: "center",
          baseline: "middle",
          color: fade(getColor("WHITE"), 0.7),
          size: 12,
        }
      );
    });
    Arr.forEach(frame.rows, (each, rowIndex) => {
      const y = table.top + rowHeight * (rowIndex + 1.5);
      const tried = evaluate(frame.gate, each);
      if (rowIndex === index) {
        sketch.noStroke();
        sketch.fill(fade(PLOT_COLORS.amber, 0.25));
        sketch.rect(
          table.left,
          y - rowHeight / 2,
          table.right - table.left,
          rowHeight
        );
      }
      const cell = {
        align: "center",
        baseline: "middle",
        color: getColor("WHITE"),
        size: 13,
      } as const;
      Arr.forEach(
        [each.a, each.b, each.c, tried.x, each.q],
        (value, column) => {
          caption(sketch, `${value}`, { x: columnX(column), y }, cell);
        }
      );
      const match = tried.q === each.q;
      caption(
        sketch,
        match ? "✓" : "✗",
        { x: columnX(5), y },
        { ...cell, color: match ? PLOT_COLORS.teal : PLOT_COLORS.pink }
      );
    });
    vignette(sketch, 0.25);
  };
}

interface LogicGateLabProps {
  description: NonNullable<ReactNode>;
  /** The gate P the trainer starts with. */
  gate: Gate;
  labels: {
    gate: string;
    matches: ReactNode;
    viewLabel: string;
  };
  /** The given rows of the truth table: inputs A, B, C and the output Q. */
  rows: readonly {
    readonly a: number;
    readonly b: number;
    readonly c: number;
    readonly q: number;
  }[];
  title: NonNullable<ReactNode>;
}

/**
 * A logic trainer with an unknown gate P feeding a NAND gate together with
 * input C. The trainer steps through the given rows of the truth table, with
 * the input lights set and the X and Q lights showing what the circuit gives.
 * Swap gate P and watch which rows it reproduces: only one gate ticks them all.
 */
export function LogicGateLab({
  description,
  gate: start,
  labels,
  rows,
  title,
}: LogicGateLabProps) {
  const [gate, setGate] = useState<Gate>(start);
  const isGate = Schema.is(GateSchema);
  const matching = Arr.filter(
    rows,
    (row) => evaluate(gate, row).q === row.q
  ).length;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.gate}
          onValueChange={(value) => {
            if (isGate(value)) {
              setGate(value);
            }
          }}
          type="single"
          value={gate}
          variant="outline"
        >
          {Arr.map(GateSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={gatesProgram}
          state={{ gate, rows }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.matches}
            value={<InlineMath math={`${matching}/${rows.length}`} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
