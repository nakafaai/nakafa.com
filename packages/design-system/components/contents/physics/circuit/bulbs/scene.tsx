import { OakBoard } from "@repo/design-system/components/contents/physics/bench/board";
import { Bulb } from "@repo/design-system/components/contents/physics/bench/bulb";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { DryCell } from "@repo/design-system/components/contents/physics/bench/cell";
import {
  Lead,
  Post,
} from "@repo/design-system/components/contents/physics/bench/lead";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import { bulbNetwork } from "@repo/design-system/components/contents/physics/circuit/current";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { Array as Arr, Option } from "effect";
import { useMemo } from "react";

/** Where the two rails of the parallel group run across the board, and where the battery and the series bulb stand. */
const BACK = -0.5;
const FRONT = 0.5;
const CELL_X = -0.98;
const SERIES_X = -0.3;
/** How fast the charge markers of one ampere drift, in scene units a second. */
const DRIFT = 0.9;

type Point = readonly [number, number, number];

/** The power at which a bulb is drawn at full brightness, a little above the brightest bulb when all of them work. */
function fullPower(emf: number, series: number, group: readonly number[]) {
  const all = bulbNetwork(
    emf,
    series,
    Arr.map(group, (resistance) => ({ broken: false, resistance }))
  );
  const lone = bulbNetwork(
    emf,
    series,
    Arr.map(group, (resistance, index) => ({
      broken: index > 0,
      resistance,
    }))
  );
  return (
    Math.max(...Arr.map([...all.bulbs, ...lone.bulbs], (bulb) => bulb.power)) *
    1.05
  );
}

/** The leads of the circuit: the feed through the series bulb, each rail segment, each branch, and the return. */
function layout(columns: readonly number[]) {
  const first = columns[0] ?? 0;
  const last = Option.getOrElse(Arr.last(columns), () => first);
  const feed: readonly Point[] = [
    [CELL_X, 0.09, -0.42],
    [CELL_X + 0.06, 0.04, BACK - 0.03],
    [-0.7, 0.03, BACK - 0.02],
    [SERIES_X - 0.12, 0.035, BACK],
  ];
  const join: readonly Point[] = [
    [SERIES_X + 0.12, 0.035, BACK],
    [-0.02, 0.03, BACK - 0.03],
    [first, 0.09, BACK],
  ];
  const home: readonly Point[] = [
    [first, 0.09, FRONT],
    [-0.3, 0.03, FRONT + 0.05],
    [CELL_X + 0.1, 0.04, FRONT + 0.03],
    [CELL_X, 0.09, 0.42],
  ];
  const rails = Arr.map(Arr.zip(columns, Arr.drop(columns, 1)), ([a, b]) => ({
    back: [
      [a, 0.09, BACK],
      [(a + b) / 2, 0.035, BACK - 0.03],
      [b, 0.09, BACK],
    ] satisfies readonly Point[],
    front: [
      [b, 0.09, FRONT],
      [(a + b) / 2, 0.035, FRONT + 0.03],
      [a, 0.09, FRONT],
    ] satisfies readonly Point[],
    key: `${a}:${b}`,
  }));
  const branches = Arr.map(columns, (x) => ({
    down: [
      [x, 0.09, BACK],
      [x + 0.03, 0.035, BACK / 2],
      [x, 0.035, -0.12],
    ] satisfies readonly Point[],
    key: x,
    up: [
      [x, 0.035, 0.12],
      [x + 0.03, 0.035, FRONT / 2],
      [x, 0.09, FRONT],
    ] satisfies readonly Point[],
  }));
  return { branches, feed, home, join, last, rails };
}

/**
 * The circuit on its oak board: a dry cell, the series bulb on the feed, and
 * the parallel bulbs side by side between two rails of binding posts, each
 * lamp glowing with its own power. The last parallel bulb is the one whose
 * filament can break. Charge markers drift along every lead in proportion to
 * the current it carries while the card plays.
 */
export function BulbNetworkScene({
  broken,
  emf,
  group,
  series,
}: {
  readonly broken: boolean;
  readonly emf: number;
  readonly group: readonly number[];
  readonly series: number;
}) {
  const last = group.length - 1;
  const network = bulbNetwork(
    emf,
    series,
    Arr.map(group, (resistance, index) => ({
      broken: broken && index === last,
      resistance,
    }))
  );
  const full = fullPower(emf, series, group);
  const columns = useMemo(
    () =>
      Arr.makeBy(last + 1, (index) => 0.28 + (index * 0.8) / Math.max(1, last)),
    [last]
  );
  const leads = useMemo(() => layout(columns), [columns]);
  const glows = Arr.map(network.bulbs, (bulb) => Math.sqrt(bulb.power / full));
  const branch = Arr.map(Arr.drop(network.bulbs, 1), (bulb) => bulb.current);
  /** The current each rail segment carries: that of every branch beyond it. */
  const beyond = Arr.map(leads.rails, (_, index) =>
    Arr.reduce(Arr.drop(branch, index + 1), 0, (sum, current) => sum + current)
  );

  return (
    <group>
      <BenchCamera
        narrow={[0, 2.7, 4.3]}
        target={[0.02, 0.2, 0]}
        wide={[0, 2.1, 3.4]}
      />
      <OakBoard depth={1.7} width={2.7}>
        <group position={[CELL_X, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <DryCell />
        </group>
        <Lead
          color={APPARATUS_COLORS.leadRed}
          flow={network.current * DRIFT}
          points={leads.feed}
        />
        <Lead
          color={APPARATUS_COLORS.leadRed}
          flow={network.current * DRIFT}
          points={leads.join}
        />
        <Lead
          color={APPARATUS_COLORS.leadBlack}
          flow={network.current * DRIFT}
          points={leads.home}
        />
        <group position={[SERIES_X, 0, BACK]}>
          <Bulb glow={glows[0] ?? 0} />
          <Tag position={[0, 0.62, 0]}>
            <InlineMath math="L_1" />
          </Tag>
        </group>
        {Arr.map(leads.rails, (rail, index) => (
          <group key={rail.key}>
            <Lead
              color={APPARATUS_COLORS.leadRed}
              flow={(beyond[index] ?? 0) * DRIFT}
              points={rail.back}
            />
            <Lead
              color={APPARATUS_COLORS.leadBlack}
              flow={(beyond[index] ?? 0) * DRIFT}
              points={rail.front}
            />
          </group>
        ))}
        {Arr.map(leads.branches, (path, index) => (
          <group key={path.key}>
            <Post
              color={APPARATUS_COLORS.leadRed}
              position={[path.key, 0, BACK]}
            />
            <Post
              color={APPARATUS_COLORS.leadBlack}
              position={[path.key, 0, FRONT]}
            />
            <Lead
              color={APPARATUS_COLORS.leadRed}
              flow={(branch[index] ?? 0) * DRIFT}
              points={path.down}
            />
            <Lead
              color={APPARATUS_COLORS.leadBlack}
              flow={(branch[index] ?? 0) * DRIFT}
              points={path.up}
            />
            <group position={[path.key, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <Bulb
                broken={broken && index === last}
                glow={glows[index + 1] ?? 0}
              />
            </group>
            <Tag position={[path.key, 0.62, 0]}>
              <InlineMath math={`L_{${index + 2}}`} />
            </Tag>
          </group>
        ))}
      </OakBoard>
    </group>
  );
}
