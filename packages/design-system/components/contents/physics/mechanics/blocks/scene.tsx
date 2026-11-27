import { useFrame } from "@react-three/fiber";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { NewtonMeter } from "@repo/design-system/components/three/apparatus/balance";
import { Block } from "@repo/design-system/components/three/apparatus/block";
import { Force } from "@repo/design-system/components/three/apparatus/force";
import {
  meterReach,
  NEWTON_METER,
} from "@repo/design-system/components/three/apparatus/newton";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Sweep } from "@repo/design-system/components/three/form/part";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { useMemo, useRef } from "react";
import type { Group } from "three";

/** Wall seconds a run lasts before the blocks start again from the left. */
const RUN_SECONDS = 3;

/** How far the blocks travel in a run at the acceleration they are drawn for. */
const RANGE = 0.18;

/** The side of a block of one kilogram, and the length of the string between the two blocks. */
const SIDE = 0.34;
const STRING = 0.48;

/** How far a screw eye stands out from the end of a block. */
const EYE = 0.062;

/**
 * How high the screw eyes sit: the height of the axis of a newton meter that
 * lies on the bench on its collars, so the meter, the cord and the string
 * all run level and the meter rests on the bench.
 */
const EYE_HIGH = NEWTON_METER.radius + 0.006;

/** The shortest a force that is not zero is drawn, so a small one can still be read. */
const SHORTEST = 0.18;

/** How long the pull is drawn: every other force is drawn to the same scale. */
const FORCE = 0.32;

/** How tall the letters of the teaching layer are, in the units of the rig. */
const LETTER = 0.12;

/** Where the camera looks from: a low three-quarter view from the front right, along the line the blocks move on, so the back edge of the bench and the room behind it stand in view. Its distance is fitted to the frame. */
const VIEW = [0.3, 0.2, 1] as const;

/** The cord the ring of the newton meter is pulled by: it runs level, out of the view. */
const CORD = [
  [0, 0, 0],
  [6, 0, 0],
] as const;

/** The size of a block of `mass` kilograms of one wood: its side grows with the cube root of its mass. */
function sizeOf(mass: number) {
  const side = SIDE * Math.cbrt(mass);
  return { deep: side * 0.9, tall: side, wide: side };
}

/**
 * Two wooden blocks on the bench joined by a string through their screw
 * eyes. A newton meter hooked to the front block is pulled by a cord on its
 * ring, and its pointer reads the pull. While the card plays the blocks speed up from
 * rest at the acceleration the lab computes and start again. The pull, the
 * tension on each block and the friction on the back block are drawn from
 * where they act, each as long as its force.
 */
export function BlocksScene({
  blocks,
  friction,
  masses,
  most,
  pull,
}: {
  /** The acceleration of both blocks in m s⁻² and the tension in the string in newtons. */
  readonly blocks: { readonly acceleration: number; readonly tension: number };
  /** The friction on the back block, in newtons. */
  readonly friction: number;
  /** The mass of each block, in kilograms. */
  readonly masses: { readonly back: number; readonly front: number };
  /** The largest pull the newton meter reads, in newtons. */
  readonly most: number;
  /** The pull on the front block, in newtons. */
  readonly pull: number;
}) {
  const format = usePrintNumber();
  const train = useRef<Group>(null);
  const clock = useSimulationClock();
  const back = sizeOf(masses.back);
  const front = sizeOf(masses.front);
  const low = Math.min(back.tall, front.tall);
  const newton = FORCE / Math.max(pull, 1);
  const reach = meterReach(pull, most);
  const whole =
    back.wide + STRING + EYE * 2 + front.wide + meterReach(most, most) + FORCE;
  const left = -(whole + RANGE) / 2;
  const rest = useMemo(() => [left, 0, 0] as const, [left]);
  const places = useMemo(() => {
    const backEnd = back.wide;
    const frontStart = backEnd + EYE * 2 + STRING;
    const frontEnd = frontStart + front.wide;
    return {
      back: backEnd / 2,
      front: (frontStart + frontEnd) / 2,
      hook: frontEnd + EYE - 0.02,
      string: [
        [backEnd + EYE, EYE_HIGH, 0],
        [frontStart - EYE, EYE_HIGH, 0],
      ],
    } as const;
  }, [back.wide, front.wide]);
  const frame = useMemo(
    () => ({
      x: {
        max:
          left +
          RANGE +
          places.hook +
          reach +
          Math.max(pull * newton, SHORTEST) +
          LETTER * 1.5,
        min: left - Math.max(friction * newton, SHORTEST) - LETTER * 1.5,
      },
      y: { max: Math.max(back.tall, front.tall), min: 0 },
      z: { max: back.deep / 2 + 0.08, min: -back.deep / 2 },
    }),
    [
      back.deep,
      back.tall,
      friction,
      front.tall,
      left,
      newton,
      places.hook,
      pull,
      reach,
    ]
  );
  const forces = useMemo(
    () =>
      ({
        drag: [
          [0, 0.04, back.deep / 2 + 0.06],
          [-Math.max(friction * newton, SHORTEST), 0.04, back.deep / 2 + 0.06],
        ],
        hold: [
          [places.string[1][0] + EYE, EYE_HIGH + 0.1, 0],
          [
            places.string[1][0] +
              EYE -
              Math.max(blocks.tension * newton, SHORTEST),
            EYE_HIGH + 0.1,
            0,
          ],
        ],
        pull: [
          [places.hook + reach, EYE_HIGH + 0.1, 0],
          [
            places.hook + reach + Math.max(pull * newton, SHORTEST),
            EYE_HIGH + 0.1,
            0,
          ],
        ],
        tow: [
          [places.string[0][0] - EYE, low - 0.05, 0],
          [
            places.string[0][0] -
              EYE +
              Math.max(blocks.tension * newton, SHORTEST),
            low - 0.05,
            0,
          ],
        ],
      }) as const,
    [back.deep, blocks.tension, friction, low, newton, places, pull, reach]
  );

  useFrame((_, delta) => {
    const time = clock.advance(delta) % RUN_SECONDS;
    const share =
      (Math.max(blocks.acceleration, 0) / Math.max(blocks.acceleration, 0.1)) *
      (time / RUN_SECONDS) ** 2;
    train.current?.position.setX(left + Math.min(share, 1) * RANGE);
  });

  return (
    <group>
      <CameraControls
        cameraPosition={VIEW}
        cameraTarget={[0, 0.3, 0]}
        fov={28}
        framing="content"
        maxPolarAngle={Math.PI * 0.49}
        minDistance={0.25}
      />
      <CameraBounds bounds={frame}>
        <group>
          <group position={rest} ref={train}>
            <group position={[places.back, 0, 0]}>
              <Block
                eye={EYE_HIGH}
                size={back}
                stamp={`${format(masses.back, 0)} kg`}
                wood="oak"
              />
            </group>
            <group position={[places.front, 0, 0]}>
              <Block
                eye={EYE_HIGH}
                size={front}
                stamp={`${format(masses.front, 0)} kg`}
                wood="beech"
              />
            </group>
            <mesh castShadow>
              <Sweep ends="round" path={places.string} radius={0.007} />
              <Matter color={MACHINE_COLORS.hemp} of="cloth" />
            </mesh>
            <mesh
              castShadow
              position={[places.hook + reach - 0.02, EYE_HIGH, 0]}
            >
              <Sweep path={CORD} radius={0.007} />
              <Matter color={MACHINE_COLORS.hemp} of="cloth" />
            </mesh>
            <group
              position={[places.hook, EYE_HIGH, 0]}
              rotation={[-0.5, 0, 0]}
            >
              <NewtonMeter color={PLOT_COLORS.pink} force={pull} most={most} />
            </group>
            <Force
              color={PLOT_COLORS.pink}
              from={forces.pull[0]}
              size={LETTER}
              to={forces.pull[1]}
            >
              <InlineMath math="F" />
            </Force>
            <Force
              color={PLOT_COLORS.teal}
              from={forces.hold[0]}
              size={LETTER}
              to={forces.hold[1]}
            >
              <InlineMath math="T" />
            </Force>
            <Force
              color={PLOT_COLORS.teal}
              from={forces.tow[0]}
              size={LETTER}
              to={forces.tow[1]}
            >
              <InlineMath math="T" />
            </Force>
            <Force
              color={PLOT_COLORS.orange}
              from={forces.drag[0]}
              size={LETTER}
              to={forces.drag[1]}
            >
              <InlineMath math="f" />
            </Force>
          </group>
        </group>
      </CameraBounds>
    </group>
  );
}
