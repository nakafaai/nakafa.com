import { useFrame } from "@react-three/fiber";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { Block } from "@repo/design-system/components/three/apparatus/block";
import {
  distanceSheet,
  spanSheet,
} from "@repo/design-system/components/three/apparatus/distance";
import {
  BULLET_LONG,
  Bullet,
} from "@repo/design-system/components/three/apparatus/hardware";
import { Rule } from "@repo/design-system/components/three/apparatus/rule";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { PrintFace } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { useMemo, useRef } from "react";
import type { Group } from "three";

/** Wall seconds the bullet takes to reach the block. */
const FLIGHT_SECONDS = 0.6;

/** Wall seconds the block holds at rest before the shot repeats. */
const HOLD_SECONDS = 1.8;

/** The block: how wide, tall and deep it is. */
const BLOCK = { deep: 0.46, tall: 0.48, wide: 0.52 } as const;

/** How high the bullet strikes the block: above the screw eye in its end. */
const STRIKE = BLOCK.tall * 0.68;

/** The rule that stands on its edge in front of the block: its length, its height and how far in front it stands. */
const RULE = { front: 0.34, long: 2.3, tall: 0.14 } as const;

/** Where the block waits for the bullet, where the bullet comes from, and how far past its zero the rule begins. */
const START = -0.8;
const MUZZLE = -2.2;
const LEAD = 0.12;

/** How far in front of the rule the stopping distance is marked. */
const MARK = RULE.front + 0.16;

/** Where the camera looks from: from the front, a little to the right and a little above, so the back edge of the bench and the room behind it stand in view. Its distance is fitted to the frame. */
const VIEW = [0.24, 0.2, 1] as const;

/** What the camera frames: the block's slide, the rule and the marked distance. The bullet flies in from outside it. */
const FRAME = {
  x: { max: START - LEAD + RULE.long, min: START - LEAD },
  y: { max: BLOCK.tall, min: 0 },
  z: { max: MARK + 0.08, min: -BLOCK.deep / 2 },
} as const;

/**
 * A bullet flies in from the left and embeds in a wooden block on the
 * bench, and the block slides to rest at the pace a steady deceleration
 * gives. A rule on its edge in front of the block reads metres from where
 * the block waited, and an amber line on the bench marks the stopping
 * distance, which the card reads out. A paused card shows the finished slide.
 */
export function BulletScene({
  distance,
  mass,
  time,
}: {
  /** How far the block slides, in metres. */
  readonly distance: number;
  /** The mass of the block, in kilograms. */
  readonly mass: number;
  /** How long the block slides, in seconds. */
  readonly time: number;
}) {
  const format = usePrintNumber();
  const block = useRef<Group>(null);
  const bullet = useRef<Group>(null);
  const lodged = useRef<Group>(null);
  // The clock starts at the finished state, so a paused card still shows the whole result.
  const clock = useSimulationClock(FLIGHT_SECONDS + time);
  const metre = (RULE.long - LEAD - 0.2) / Math.max(distance * 1.15, 0.5);
  const end = START + distance * metre;
  const rest = useMemo(() => [end, 0, 0] as const, [end]);
  const scale = useMemo(
    () =>
      distanceSheet(
        { long: RULE.long, metre, start: LEAD, tall: RULE.tall },
        distance,
        INSTRUMENT_COLORS.graphite,
        format
      ),
    [distance, format, metre]
  );
  const span = useMemo(() => spanSheet(end - START, PLOT_COLORS.amber), [end]);

  useFrame((_, delta) => {
    const now = clock.advance(delta) % (FLIGHT_SECONDS + time + HOLD_SECONDS);
    const sliding = Math.min(Math.max(now - FLIGHT_SECONDS, 0), time);
    const flying = now < FLIGHT_SECONDS;
    block.current?.position.setX(
      START + distance * (1 - (1 - sliding / time) ** 2) * metre
    );
    if (bullet.current !== null && lodged.current !== null) {
      bullet.current.visible = flying;
      lodged.current.visible = !flying;
      bullet.current.position.setX(
        MUZZLE +
          (START - BLOCK.wide / 2 - BULLET_LONG - MUZZLE) *
            (now / FLIGHT_SECONDS)
      );
    }
  });

  return (
    <group>
      <CameraControls
        cameraPosition={VIEW}
        cameraTarget={[0, 0.2, 0]}
        fov={28}
        framing="content"
        maxPolarAngle={Math.PI * 0.49}
        minDistance={0.25}
      />
      <CameraBounds bounds={FRAME}>
        <group>
          <group position={[MUZZLE, STRIKE, 0]} ref={bullet}>
            <Bullet />
          </group>
          <group position={rest} ref={block}>
            <Block
              eye={BLOCK.tall / 2}
              size={BLOCK}
              stamp={`${format(mass, 2)} kg`}
              wood="oak"
            />
            <group position={[-BLOCK.wide / 2 - 0.004, STRIKE, 0]} ref={lodged}>
              <Bullet lodged />
            </group>
          </group>
          <group position={[START - LEAD + RULE.long / 2, 0, RULE.front]}>
            <Rule sheet={scale} stands="edge" />
          </group>
          <group
            position={[(START + end) / 2, 0.003, MARK]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <PrintFace sheet={span} stock="ink" />
          </group>
        </group>
      </CameraBounds>
    </group>
  );
}
