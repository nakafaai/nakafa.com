import { Line } from "@react-three/drei";
import {
  Flask,
  FlaskLiquid,
  LabBench,
} from "@repo/design-system/components/contents/chemistry/bench";
import {
  amountAt,
  type Solid,
  TIME_SPAN,
} from "@repo/design-system/components/contents/chemistry/rate/curve";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";

/** One run: its solid, the final amount of gas it gives off in mol, and its name on the graph. */
interface RateRun {
  /** The final amount of gas, in mol. */
  readonly amount: number;
  /** That amount as math, in the reader's number format. */
  readonly amountTex: string;
  /** The run's name on the graph and in the footer. */
  readonly label: ReactNode;
  /** How finely its solid is divided. */
  readonly solid: Solid;
}

/** Where the runs stand, either side of the graph. */
const RUN_X = 0.21;

/** The gas syringe's barrel: its height, length, radius, and how far it starts from the flask. */
const SYRINGE_Y = 0.2;
const SYRINGE_LENGTH = 0.15;
const SYRINGE_RADIUS = 0.015;
const SYRINGE_GAP = 0.05;

/** The graph board's middle, size, and the samples each curve takes. */
const BOARD_Y = 0.27;
const BOARD_WIDTH = 0.3;
const BOARD_HEIGHT = 0.26;
const SAMPLES = 120;

/** How many pieces of a solid a flask shows, and their edge in metres. */
const PiecesSchema = Schema.Struct({ count: Schema.Int, size: Schema.Finite });

/** How many pieces of solid each form shows in the flask, and their edge in metres. */
const PIECES = {
  chips: { count: 6, size: 0.009 },
  granules: { count: 14, size: 0.005 },
  powder: { count: 40, size: 0.002 },
} satisfies Record<Solid, typeof PiecesSchema.Type>;

/** Each run's colour on the graph, named in the footer as well. */
export const RUN_COLORS = [PLOT_COLORS.teal, PLOT_COLORS.orange] as const;

/**
 * Up to two runs of a reaction that gives off a gas, at bench scale: each a
 * conical flask of acid with its solid, stoppered, its gas led to a gas
 * syringe whose plunger moves out as the gas collects. With the curves shown,
 * a board between the runs plots each run's amount of gas against time from
 * the same formula that moves the plungers, and a dot marks the time chosen.
 */
export function RateScene({
  children,
  runs,
  showCurves,
  time,
}: {
  readonly children?: ReactNode;
  readonly runs: Arr.NonEmptyReadonlyArray<RateRun>;
  readonly showCurves: boolean;
  readonly time: number;
}) {
  const most = largest(runs);
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
      {children}
    </group>
  );
}

/** One run's flask, solid, delivery tube and gas syringe. */
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
  const start = x + side * SYRINGE_GAP;
  const plunger = start + side * (0.01 + filled * (SYRINGE_LENGTH - 0.02));
  const { count: pieces, size } = PIECES[run.solid];

  return (
    <group position={[0, 0, 0.1]}>
      <group position={[x, 0, 0]}>
        <Flask />
        <FlaskLiquid color={MATERIAL.solution} level={0.04} opacity={0.3} />
        {Arr.makeBy(pieces, (index) => {
          const angle = index * 2.4;
          const radius = 0.006 + ((index * 7) % 10) * 0.0028;
          return (
            <mesh
              key={String(index)}
              position={[
                Math.cos(angle) * radius,
                0.004 + size / 2,
                Math.sin(angle) * radius,
              ]}
            >
              <boxGeometry args={[size, size, size]} />
              <meshStandardMaterial
                color={MATERIAL.bakingSoda}
                roughness={0.9}
              />
            </mesh>
          );
        })}
        <mesh position={[0, 0.152, 0]}>
          <cylinderGeometry args={[0.019, 0.016, 0.022, 20]} />
          <meshStandardMaterial color={MATERIAL.stopper} roughness={0.7} />
        </mesh>
      </group>
      <Line
        color={MATERIAL.glass}
        lineWidth={3}
        points={[
          [x, 0.16, 0],
          [x, SYRINGE_Y, 0],
          [start, SYRINGE_Y, 0],
        ]}
      />
      <mesh
        position={[start + (side * SYRINGE_LENGTH) / 2, SYRINGE_Y, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry
          args={[SYRINGE_RADIUS, SYRINGE_RADIUS, SYRINGE_LENGTH, 24, 1, true]}
        />
        <GlassMaterial color={MATERIAL.glass} opacity={0.3} />
      </mesh>
      <mesh position={[plunger, SYRINGE_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry
          args={[SYRINGE_RADIUS - 0.001, SYRINGE_RADIUS - 0.001, 0.006, 24]}
        />
        <meshStandardMaterial color={MATERIAL.stopper} roughness={0.5} />
      </mesh>
      <mesh
        position={[plunger + side * 0.05, SYRINGE_Y, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.003, 0.003, 0.1, 12]} />
        <MetalMaterial color={MATERIAL.probeSteel} roughness={0.3} />
      </mesh>
      <ThreeLabel
        color={ORIGIN_COLOR.DARK}
        fontSize="compact"
        outlineColor={ORIGIN_COLOR.LIGHT}
        outlineWidth={0.004}
        position={[x, -0.02, 0.06]}
      >
        {run.label}
      </ThreeLabel>
    </group>
  );
}

/** The graph board: amount of gas against time, one curve per run, and a dot at the chosen time. */
export function Board({
  runs,
  time,
  timeLabel,
}: {
  readonly runs: Arr.NonEmptyReadonlyArray<RateRun>;
  readonly time: number;
  readonly timeLabel: string;
}) {
  const most = largest(runs);
  const left = -BOARD_WIDTH / 2 + 0.02;
  const bottom = BOARD_Y - BOARD_HEIGHT / 2 + 0.03;
  const width = BOARD_WIDTH - 0.04;
  const height = BOARD_HEIGHT - 0.06;
  const point = (t: number, amount: number) =>
    [
      left + (t / TIME_SPAN) * width,
      bottom + (amount / most) * height * 0.9,
      0.006,
    ] as const;

  return (
    <group position={[0, 0, -0.12]}>
      <mesh position={[0, BOARD_Y, 0]}>
        <boxGeometry args={[BOARD_WIDTH, BOARD_HEIGHT, 0.008]} />
        <meshStandardMaterial color={MATERIAL.paper} roughness={0.9} />
      </mesh>
      <Line
        color={MATERIAL.graphite}
        lineWidth={1.5}
        points={[
          [left, bottom + height, 0.006],
          [left, bottom, 0.006],
          [left + width, bottom, 0.006],
        ]}
      />
      {Arr.map(runs, (run, index) => {
        const color = RUN_COLORS[index === 0 ? 0 : 1];
        const samples = Arr.makeBy(SAMPLES + 1, (step) => {
          const t = (step / SAMPLES) * TIME_SPAN;
          return point(t, amountAt(run.amount, run.solid, t));
        });
        const dot = point(time, amountAt(run.amount, run.solid, time));
        return (
          <group key={String(index)}>
            <Line color={color} lineWidth={2.5} points={samples} />
            <mesh position={dot}>
              <sphereGeometry args={[0.004, 12, 8]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <ThreeLabel
              anchorX="right"
              color={color}
              fontSize="compact"
              gap={0.004}
              position={[left, point(0, run.amount)[1], 0.006]}
            >
              <InlineMath math={run.amountTex} />
            </ThreeLabel>
          </group>
        );
      })}
      <ThreeLabel
        anchorY="top"
        color={ORIGIN_COLOR.DARK}
        fontSize="compact"
        gap={0.004}
        position={[0, bottom, 0.006]}
      >
        {timeLabel}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ORIGIN_COLOR.DARK}
        fontSize="compact"
        gap={0.004}
        position={[left, bottom + height, 0.006]}
      >
        <InlineMath math="n\ (\mathrm{mol})" />
      </ThreeLabel>
    </group>
  );
}

/** The largest final amount of the runs, which the graph and the syringes scale to. */
function largest(runs: readonly RateRun[]) {
  return Arr.reduce(runs, 0, (most, run) => Math.max(most, run.amount));
}
