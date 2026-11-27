import { useFrame } from "@react-three/fiber";
import { expectedCounts } from "@repo/design-system/components/contents/mathematics/galton/binomial";
import {
  BALL_RADIUS,
  binCentre,
  DIVIDER,
  GAP,
  hopperPoints,
  PITCH,
  pileLevel,
} from "@repo/design-system/components/contents/mathematics/galton/board";
import {
  BALLS,
  ballAt,
  landedBy,
  planRun,
  releasedBy,
  runEnd,
} from "@repo/design-system/components/contents/mathematics/galton/run";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { GALTON_COLORS } from "@repo/design-system/lib/material/galton";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option } from "effect";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Object3D } from "three";

/** The least time between two readouts of the landed balls while the run plays, in seconds of the run. */
const REPORT_EVERY = 0.15;

/** A mark on the glass: as wide as a bin, 2.2 mm tall. */
const MARK = { height: 0.0022, width: PITCH - DIVIDER - 0.002 } as const;

/**
 * The run's balls: those still waiting in the hopper, those bouncing down
 * the pins and those resting in the bins, and over each bin a mark printed on
 * the glass at the height the binomial formula expects for the balls landed
 * so far. Each group is one instanced mesh, so hundreds of balls cost three
 * draw calls. The marks show only with `showExpected`. The scene tells the
 * card how many balls have landed.
 */
export function GaltonBalls({
  front,
  onLanded,
  p,
  rows,
  showExpected,
}: {
  readonly front: number;
  readonly onLanded: (count: number) => void;
  readonly p: number;
  readonly rows: number;
  readonly showExpected: boolean;
}) {
  const plans = useMemo(() => planRun(rows, p), [p, rows]);
  const { advance, playing } = useTimeline(0, runEnd(plans));
  const moving = useRef<InstancedMesh>(null);
  const waiting = useRef<InstancedMesh>(null);
  const marks = useRef<InstancedMesh>(null);
  const place = useMemo(() => new Object3D(), []);
  const shown = useRef({ landed: -1, reportedAt: 0, time: Number.NaN });

  useLayoutEffect(() => {
    const hopper = waiting.current;
    if (hopper === null) {
      return;
    }
    Arr.forEach(hopperPoints(BALLS), (point, index) => {
      place.position.set(point.x, point.y, GAP / 2);
      place.updateMatrix();
      hopper.setMatrixAt(index, place.matrix);
    });
    hopper.instanceMatrix.needsUpdate = true;
  }, [place]);

  useFrame((_, delta) => {
    const time = advance(delta);
    if (time === shown.current.time) {
      return;
    }
    const balls = moving.current;
    const hopper = waiting.current;
    const levels = marks.current;
    if (balls === null || hopper === null || levels === null) {
      return;
    }
    shown.current.time = time;
    const released = releasedBy(plans, time);
    hopper.count = BALLS - released;
    balls.count = released;
    Arr.forEach(Arr.take(plans, released), (plan, index) => {
      const point = Option.getOrElse(ballAt(plan, rows, time), () => plan.rest);
      place.position.set(point.x, point.y, GAP / 2);
      place.updateMatrix();
      balls.setMatrixAt(index, place.matrix);
    });
    balls.instanceMatrix.needsUpdate = true;
    const landed = landedBy(plans, time);
    Arr.forEach(expectedCounts(rows, p, landed), (expected, bin) => {
      place.position.set(binCentre(rows, bin), pileLevel(expected), front);
      place.updateMatrix();
      levels.setMatrixAt(bin, place.matrix);
    });
    levels.count = showExpected && landed > 0 ? rows + 1 : 0;
    levels.instanceMatrix.needsUpdate = true;
    if (
      landed !== shown.current.landed &&
      (landed === BALLS ||
        !playing ||
        Math.abs(time - shown.current.reportedAt) >= REPORT_EVERY)
    ) {
      shown.current.landed = landed;
      shown.current.reportedAt = time;
      onLanded(landed);
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <instancedMesh
        args={[undefined, undefined, BALLS]}
        castShadow
        frustumCulled={false}
        ref={moving}
      >
        <sphereGeometry args={[BALL_RADIUS, 28, 20]} />
        <SteelMaterial />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, BALLS]}
        castShadow
        frustumCulled={false}
        ref={waiting}
      >
        <sphereGeometry args={[BALL_RADIUS, 28, 20]} />
        <SteelMaterial />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, rows + 1]}
        frustumCulled={false}
        ref={marks}
      >
        <boxGeometry args={[MARK.width, MARK.height, 0.0012]} />
        <meshStandardMaterial
          color={PLOT_COLORS.pink}
          emissive={PLOT_COLORS.pink}
          emissiveIntensity={0.35}
          roughness={0.45}
        />
      </instancedMesh>
    </group>
  );
}

/** Polished bearing steel, mirror bright under the studio's lights. */
function SteelMaterial() {
  return (
    <meshPhysicalMaterial
      clearcoat={0.6}
      clearcoatRoughness={0.05}
      color={GALTON_COLORS.ball}
      metalness={1}
      roughness={0.08}
    />
  );
}
