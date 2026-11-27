import { LogicGateScene } from "@repo/design-system/components/contents/physics/electronics/gates/scene";
import type { Gate } from "@repo/design-system/components/contents/physics/electronics/logic";
import {
  GateSchema,
  gateOutput,
} from "@repo/design-system/components/contents/physics/electronics/logic";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

/** One row of the given truth table: the inputs A, B and C, and the output Q the circuit gave. */
const RowSchema = Schema.Struct({
  a: Schema.Finite,
  b: Schema.Finite,
  c: Schema.Finite,
  q: Schema.Finite,
});
type Row = typeof RowSchema.Type;

/** The circuit's output for one row with gate P: X from P, then Q from the NAND gate of X and C. */
function evaluate(gate: Gate, row: Row) {
  const x = gateOutput(gate, row.a, row.b);
  return { q: gateOutput("NAND", x, row.c), x };
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
    <VisualCard
      onReset={() => {
        setGate(start);
      }}
    >
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
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.4} setting="lab">
          <Suspense fallback={null}>
            <LogicGateScene
              readings={Arr.map(rows, (row) => {
                const tried = evaluate(gate, row);
                return { ...row, ...tried, match: tried.q === row.q };
              })}
            />
          </Suspense>
        </ScienceStage>
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
