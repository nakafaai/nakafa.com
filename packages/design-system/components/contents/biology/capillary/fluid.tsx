import { useFrame, useThree } from "@react-three/fiber";
import {
  BLOCK,
  CAPILLARIES,
  CAPILLARY,
  LYMPH,
  LYMPH_PATH,
  outer,
} from "@repo/design-system/components/contents/biology/capillary/bed";
import { useFlowTime } from "@repo/design-system/components/contents/biology/capillary/flow";
import type { Bed } from "@repo/design-system/components/contents/biology/capillary/starling";
import {
  exchange,
  leaving,
  lymphShare,
  returning,
} from "@repo/design-system/components/contents/biology/capillary/starling";
import type { Axis } from "@repo/design-system/components/contents/biology/capillary/sweep";
import {
  pointOn,
  useAxis,
} from "@repo/design-system/components/contents/biology/capillary/sweep";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { CAPILLARY_COLORS } from "@repo/design-system/lib/material/capillary";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Matrix4, Vector3 } from "three";

/** How many markers of water the drawing keeps moving through the tissue. */
const POOL = 110;

/** How many seconds one marker takes from the blood to where it ends. */
const CYCLE = 8;

/** The waypoints of one journey: out of the wall, above the cells, across, back to a wall, and in. */
const WAYPOINTS = 5;

/** Where each leg of a journey starts, as a share of the cycle: out of the wall, across the tissue, down to a wall, and through it. */
const LEGS = [0, 0.1, 0.72, 0.86] as const;

/** The capillaries that exchange fluid; the short cross-link only carries blood between two of them. */
const EXCHANGING = Arr.take(CAPILLARIES, 4);

/** A capillary's radius: the same all along. */
function capillaryRadius() {
  return outer(CAPILLARY);
}

/** How the Starling forces of a bed set the markers' traffic. */
function trafficOf(bed: Bed, worst: Bed) {
  const { filtered, reabsorbed } = exchange(bed);
  const most = Math.max(exchange(worst).filtered, filtered, 1e-6);
  return {
    bed,
    drawn: Math.sqrt(Math.max(0, reabsorbed - filtered) / most),
    lymph: lymphShare(bed),
    out: Math.sqrt(Math.max(0, filtered) / most),
  };
}
type Traffic = ReturnType<typeof trafficOf>;

/**
 * The tissue fluid: markers of water and small solutes leaving the
 * capillaries through the clefts in their walls, densest where the Starling
 * forces filter hardest, rising among the tissue cells, and then either
 * returning into the venous stretch or draining into the lymph capillary,
 * in the share the model gives. The number in flight follows how much the
 * capillaries filter. When the blood pressure is below the plasma protein's
 * pull, markers are drawn in from the tissue instead. Water is drawn as
 * markers far larger than its molecules.
 *
 * @param bed - The pressures of the bed
 * @param worst - The bed at the sliders' most filtering ends, which the traffic is scaled against
 */
export function TissueFluid({
  bed,
  worst,
}: {
  readonly bed: Bed;
  readonly worst: Bed;
}) {
  const first = useAxis(EXCHANGING[0]?.path ?? [], capillaryRadius, 360, true);
  const second = useAxis(EXCHANGING[1]?.path ?? [], capillaryRadius, 360, true);
  const third = useAxis(EXCHANGING[2]?.path ?? [], capillaryRadius, 300, true);
  const fourth = useAxis(EXCHANGING[3]?.path ?? [], capillaryRadius, 300, true);
  const axes = useMemo(
    () => [first, second, third, fourth],
    [first, second, third, fourth]
  );
  const traffic = useMemo(() => trafficOf(bed, worst), [bed, worst]);
  const invalidate = useThree((state) => state.invalidate);
  const journeys = useMemo(
    () => ({
      cycles: new Float64Array(POOL).fill(-1),
      moving: new Uint8Array(POOL),
      points: new Float32Array(POOL * WAYPOINTS * 3),
    }),
    []
  );
  const mesh = useRef<InstancedMesh>(null);
  const time = useFlowTime(CYCLE * 0.55);
  const scratch = useMemo(
    () => ({
      from: new Vector3(),
      matrix: new Matrix4(),
      point: new Vector3(),
      to: new Vector3(),
    }),
    []
  );

  // New pressures send every marker on a new journey at once, drawn on the
  // next frame, which a canvas that draws on demand must be asked for.
  useEffect(() => {
    const point = new Vector3();
    Arr.forEach(Arr.range(0, POOL - 1), (index) => {
      const cycle = Math.floor(time.current / CYCLE + hashUnit(index, 1));
      depart(index, cycle, axes, traffic, journeys, point);
    });
    invalidate();
  }, [axes, invalidate, journeys, time, traffic]);

  useFrame(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    Arr.forEach(Arr.range(0, POOL - 1), (index) => {
      const clock = time.current / CYCLE + hashUnit(index, 1);
      const cycle = Math.floor(clock);
      const progress = clock - cycle;
      if (journeys.cycles[index] !== cycle) {
        depart(index, cycle, axes, traffic, journeys, scratch.point);
      }
      travel(journeys.points, index, progress, scratch);
      const grow = Math.min(1, progress * 14, (1 - progress) * 14);
      const size = journeys.moving[index] === 1 ? grow : 0;
      scratch.matrix.makeScale(size, size, size).setPosition(scratch.point);
      target.setMatrixAt(index, scratch.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      args={[undefined, undefined, POOL]}
      frustumCulled={false}
      ref={mesh}
    >
      <icosahedronGeometry args={[0.075, 1]} />
      <meshPhysicalMaterial
        clearcoat={1}
        color={CAPILLARY_COLORS.water}
        emissive={CAPILLARY_COLORS.water}
        emissiveIntensity={0.3}
        roughness={0.15}
      />
    </instancedMesh>
  );
}

/** Sends one marker on its journey for one cycle, and keeps whether it travels. */
function depart(
  index: number,
  cycle: number,
  axes: readonly Axis[],
  traffic: Traffic,
  journeys: {
    readonly cycles: Float64Array;
    readonly moving: Uint8Array;
    readonly points: Float32Array;
  },
  point: Vector3
) {
  journeys.cycles[index] = cycle;
  journeys.moving[index] = plan(
    index,
    cycle,
    axes,
    traffic,
    journeys.points,
    point
  )
    ? 1
    : 0;
}

/**
 * Plans one marker's journey for one cycle and writes its waypoints into
 * `points`. A marker either leaves the blood, as the capillaries filter, or
 * is drawn back from the tissue when they take back more than they filter.
 * Returns whether the marker travels this cycle.
 */
function plan(
  index: number,
  cycle: number,
  axes: readonly Axis[],
  traffic: Traffic,
  points: Float32Array,
  point: Vector3
) {
  const axis = axes[Math.floor(hashUnit(index, cycle + 11) * axes.length)];
  const pick = hashUnit(index * 7 + cycle, 3);
  if (axis === undefined || pick >= traffic.out + traffic.drawn) {
    return false;
  }
  const write = (slot: number) =>
    point.toArray(points, (index * WAYPOINTS + slot) * 3);
  const height = 1.15 + 0.4 * hashUnit(index, cycle + 17);
  const side = hashUnit(index, cycle + 19) < 0.5 ? -0.6 : 0.6;
  const wall = outer(CAPILLARY);
  const leaves = pick < traffic.out;
  const back = returning(traffic.bed, hashUnit(index, cycle + 9));
  const out = leaves ? leaving(traffic.bed, hashUnit(index, cycle + 5)) : back;
  pointOn(axis, out, leaves ? wall : wall + 1.2, side, point);
  write(0);
  pointOn(axis, out, wall + 0.3, side * 1.8, point).setY(height * 0.75);
  write(1);
  if (leaves && hashUnit(index, cycle + 7) < traffic.lymph) {
    const x = Math.min(
      BLOCK.right - 1.2,
      Math.max(LYMPH_PATH.start[0] + 0.8, point.x)
    );
    const front = LYMPH_PATH.start[2] + outer(LYMPH) * 0.72;
    point.set(x, height + 0.9, front + 1.2);
    write(2);
    point.set(x + 0.25, LYMPH_PATH.start[1] + outer(LYMPH) * 0.55, front - 0.3);
    write(3);
    point.set(
      Math.min(BLOCK.right - 0.3, x + 1.8),
      LYMPH_PATH.start[1] + hashUnit(index, cycle) - 0.5,
      LYMPH_PATH.start[2] + 0.3
    );
    write(4);
    return true;
  }
  pointOn(axis, back, wall + 0.3, side * 1.8, point).setY(height);
  write(2);
  pointOn(axis, back, wall, side, point);
  write(3);
  pointOn(axis, Math.min(1, back + 0.03), 0.06, 0, point);
  write(4);
  return true;
}

/**
 * Writes where a marker stands at `progress` through its cycle into
 * `scratch.point`, easing along the leg it is on.
 */
function travel(
  points: Float32Array,
  index: number,
  progress: number,
  scratch: {
    readonly from: Vector3;
    readonly point: Vector3;
    readonly to: Vector3;
  }
) {
  const leg = Arr.reduce(LEGS, -1, (found, start) =>
    progress >= start ? found + 1 : found
  );
  const start = LEGS[leg] ?? 0;
  const end = LEGS[leg + 1] ?? 1;
  const share = (progress - start) / (end - start);
  const eased = share * share * (3 - 2 * share);
  const base = index * WAYPOINTS * 3;
  scratch.from.fromArray(points, base + leg * 3);
  scratch.to.fromArray(points, base + (leg + 1) * 3);
  scratch.point.copy(scratch.from).lerp(scratch.to, eased);
}
