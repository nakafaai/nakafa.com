import {
  Flask,
  FlaskLiquid,
  LabBench,
} from "@repo/design-system/components/contents/chemistry/bench";
import type { Solid } from "@repo/design-system/components/contents/chemistry/rate/curve";
import { amountAt } from "@repo/design-system/components/contents/chemistry/rate/curve";
import {
  Bung,
  DeliveryTube,
  GasSyringe,
  SYRINGE,
  SyringeStand,
} from "@repo/design-system/components/contents/chemistry/rate/rig";
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

/** Where the runs' flasks stand, either side of the bench's middle, their syringes pointing inward. */
const RUN_X = 0.36;

/** How high a flask's bung sits in its neck. */
const BUNG_Y = 0.136;

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
 * led through a bent glass tube to a glass gas syringe clamped on a retort
 * stand. With the curves shown, each plunger moves out as the gas collects,
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
  return (
    <group>
      <LabBench width={3} />
      {Arr.map(runs, (run, index) => (
        <RunRig
          filled={showCurves ? amountAt(run.amount, run.solid, time) / most : 0}
          key={String(index)}
          run={run}
          side={index === 0 ? -1 : 1}
        />
      ))}
    </group>
  );
}

/** One run's flask, solid, bung, delivery tube, and its gas syringe on a stand. */
function RunRig({
  filled,
  run,
  side,
}: {
  readonly filled: number;
  readonly run: RateRun;
  readonly side: -1 | 1;
}) {
  const x = side * RUN_X;
  const inward = side === -1 ? 1 : -1;
  const { count: pieces, size } = PIECES[run.solid];

  return (
    <group position={[0, 0, 0.1]}>
      <group position={[x, 0, 0]}>
        <Flask />
        <FlaskLiquid
          color={REAGENT_COLORS.solution}
          level={0.04}
          opacity={0.3}
        />
        {Arr.makeBy(pieces, (index) => {
          const angle = index * 2.4;
          const radius = 0.006 + ((index * 7) % 10) * 0.0028;
          return (
            <mesh
              castShadow
              key={String(index)}
              position={[
                Math.cos(angle) * radius,
                0.004 + size * 0.4,
                Math.sin(angle) * radius,
              ]}
              rotation={[index * 1.3, index * 2.1, index * 0.7]}
              scale={[1, 0.72 + (index % 3) * 0.12, 0.85]}
            >
              <dodecahedronGeometry args={[size * 0.62, 0]} />
              <meshStandardMaterial
                args={[
                  {
                    color: REAGENT_COLORS.bakingSoda,
                    flatShading: true,
                    roughness: 0.9,
                  },
                ]}
              />
            </mesh>
          );
        })}
        <group position={[0, BUNG_Y, 0]}>
          <Bung />
          <DeliveryTube
            reach={inward * SYRINGE.gap}
            rise={SYRINGE.y - BUNG_Y}
          />
        </group>
        <group position={[inward * SYRINGE.gap, SYRINGE.y, 0]}>
          <GasSyringe filled={filled} side={inward} />
        </group>
        <group
          position={[
            inward * (SYRINGE.gap + 0.024 + SYRINGE.length * 0.6),
            0,
            0,
          ]}
        >
          <SyringeStand height={SYRINGE.y} />
        </group>
      </group>
      <ThreeLabel
        anchorX={side === -1 ? "left" : "right"}
        color={ORIGIN_COLOR.LIGHT}
        fontSize="compact"
        maximumFontSize={17}
        outlineColor={ORIGIN_COLOR.DARK}
        outlineWidth={0.006}
        position={[x + side * 0.045, -0.02, 0.06]}
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
