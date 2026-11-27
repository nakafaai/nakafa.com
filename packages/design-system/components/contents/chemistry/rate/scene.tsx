import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  BENCH_LABEL,
  BENCH_LABEL_OUTLINE,
} from "@repo/design-system/components/contents/chemistry/label";
import type { Solid } from "@repo/design-system/components/contents/chemistry/rate/curve";
import { amountAt } from "@repo/design-system/components/contents/chemistry/rate/curve";
import { SYRINGE } from "@repo/design-system/components/three/apparatus/barrel";
import {
  boreAt,
  glassOf,
} from "@repo/design-system/components/three/apparatus/glass";
import { Lumps } from "@repo/design-system/components/three/apparatus/lumps";
import { Stand } from "@repo/design-system/components/three/apparatus/stand";
import {
  Bung,
  Delivery,
} from "@repo/design-system/components/three/apparatus/stopper";
import { Syringe } from "@repo/design-system/components/three/apparatus/syringe";
import { Vessel } from "@repo/design-system/components/three/apparatus/vessel";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";

/** One run: its solid, the final amount of gas it gives off in mol, and its name on the graph. */
export interface RateRun {
  /** The final amount of gas, in mol. */
  readonly amount: number;
  /** That amount as math, in the reader's number format. */
  readonly amountTex: string;
  /** The run's name on the graph and in the footer. */
  readonly label: ReactNode;
  /** How finely its solid is divided. */
  readonly solid: Solid;
}

/** The flask of a run, and the acid in it in millilitres. */
const FLASK = { capacity: 250, kind: "conical" } as const;
const ACID = 60;
const GLASS = glassOf(FLASK);

/**
 * Where each run's flask stands along the bench and how high its syringe
 * lies, in metres: the first run's syringe over the second's, on one stand,
 * so the two plungers start at the same place and their travel compares at
 * a glance.
 */
const ROWS = [
  { flask: -0.3, y: 0.34 },
  { flask: -0.19, y: 0.215 },
] as const;

/** Where every syringe's nozzle ends along the bench, and where the rigs stand on it: to the right of the reagent bottles and behind its middle. */
const NOZZLE = -0.12;
const PLACE = [0.14, 0, -0.13] as const;

/** Where the stand grips each syringe, along the barrel from the nozzle's end, and how far behind the syringes its rod stands. */
const GRIP = { along: 0.14, back: 0.1 } as const;

/** How far a syringe reaches from the end of its nozzle to its thumb plate when it is full. */
const REACH = 0.34;

/** How far over a delivery tube its run's name is written. */
const NAME = 0.03;

/**
 * What the camera frames, in metres: the upright face of the rigs, from the
 * outer flask to the thumb plate of a full syringe, and from the bench to
 * the top of the stand's rod over as many syringes as there are runs.
 */
function frameOf(rows: readonly (typeof ROWS)[number][]) {
  const top = Arr.reduce(rows, 0, (most, row) => Math.max(most, row.y));
  return {
    x: { max: PLACE[0] + NOZZLE + REACH, min: PLACE[0] - 0.36 },
    y: { max: top + 0.1, min: -0.03 },
    z: { max: PLACE[2] + 0.05, min: PLACE[2] - 0.05 },
  };
}

/** The rows the runs take: one run lies in the lower row, two take both. */
function rowsOf(count: number) {
  return count === 1 ? Arr.of(ROWS[1]) : Arr.make(ROWS[0], ROWS[1]);
}

/** How many pieces of a solid a flask shows, and their size in metres. */
const PiecesSchema = Schema.Struct({ count: Schema.Int, size: Schema.Finite });

/** How many pieces of solid each form shows in the flask, and their size in metres. */
const PIECES = {
  chips: { count: 6, size: 0.009 },
  granules: { count: 14, size: 0.005 },
  powder: { count: 40, size: 0.002 },
} satisfies Record<Solid, typeof PiecesSchema.Type>;

/** Each run's colour on the graph, named in the footer as well. */
export const RUN_COLORS = [PLOT_COLORS.teal, PLOT_COLORS.orange] as const;

/**
 * Up to two runs of a reaction that gives off a gas, at bench scale: each a
 * conical flask of acid with its solid, closed with a rubber bung, its gas
 * led through a bent glass tube to a 100 mL glass gas syringe. The syringes
 * lie level one over the other in the clamps of one retort stand. With the curves shown, each plunger moves out as the gas collects,
 * by the same formula that draws the graph under the scene.
 */
export function RateScene({
  runs,
  showCurves,
  time,
}: {
  readonly runs: Arr.NonEmptyReadonlyArray<RateRun>;
  readonly showCurves: boolean;
  readonly time: number;
}) {
  const most = largestAmount(runs);
  const rows = rowsOf(runs.length);
  const grip = NOZZLE + GRIP.along;
  return (
    <group>
      <CameraBounds exclude>
        <LabBench width={3} />
      </CameraBounds>
      <CameraBounds bounds={frameOf(rows)}>
        <group position={PLACE}>
          {Arr.map(Arr.zip(runs, rows), ([run, row], index) => (
            <RunRig
              filled={
                showCurves ? amountAt(run.amount, run.solid, time) / most : 0
              }
              key={String(index)}
              row={row}
              run={run}
            />
          ))}
          <Stand
            at={[grip, -GRIP.back]}
            height={Arr.headNonEmpty(rows).y + 0.09}
            holds={Arr.map(rows, (row) => ({
              at: [grip, row.y, 0] as const,
              lies: "level" as const,
              radius: SYRINGE.radius,
            }))}
          />
        </group>
      </CameraBounds>
    </group>
  );
}

/** One run's flask, solid, bung and delivery tube, its gas syringe, and its name over the tube that leads to it. */
function RunRig({
  filled,
  row,
  run,
}: {
  readonly filled: number;
  readonly row: (typeof ROWS)[number];
  readonly run: RateRun;
}) {
  const { count: pieces, size } = PIECES[run.solid];

  return (
    <group>
      <group position={[row.flask, 0, 0]}>
        <Vessel
          capacity={FLASK.capacity}
          holds={{ color: REAGENT_COLORS.solution, strength: 3, volume: ACID }}
          kind={FLASK.kind}
        >
          <group position={[0, GLASS.base, 0]}>
            <Lumps
              color={REAGENT_COLORS.bakingSoda}
              count={pieces}
              size={size}
            />
          </group>
        </Vessel>
        <group position={[0, GLASS.height, 0]}>
          <Bung bore={boreAt(FLASK, GLASS.height - 0.004)} />
          <Delivery reach={NOZZLE - row.flask} rise={row.y - GLASS.height} />
        </group>
      </group>
      <group position={[NOZZLE, row.y, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <Syringe holds={filled * SYRINGE.capacity} />
      </group>
      <ThreeLabel
        anchorX="left"
        anchorY="bottom"
        color={ORIGIN_COLOR.LIGHT}
        {...BENCH_LABEL}
        outlineColor={ORIGIN_COLOR.DARK}
        outlineWidth={BENCH_LABEL_OUTLINE}
        position={[row.flask + 0.012, row.y + NAME, 0]}
      >
        {run.label}
      </ThreeLabel>
    </group>
  );
}

/** The largest final amount of the runs, which the graph and the syringes scale to. */
export function largestAmount(runs: readonly RateRun[]) {
  return Arr.reduce(runs, 0, (most, run) => Math.max(most, run.amount));
}
