import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { Stand } from "@repo/design-system/components/contents/physics/bench/stand";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Block } from "@repo/design-system/components/three/apparatus/block";
import {
  Force,
  Letter,
} from "@repo/design-system/components/three/apparatus/force";
import {
  INCLINE,
  Incline,
} from "@repo/design-system/components/three/apparatus/incline";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { useMemo, useRef, useState } from "react";
import type { Group } from "three";

/** Wall seconds the block holds at its highest point before it starts again. */
const HOLD_SECONDS = 1.5;

/** Where along the bench the hinge of the plane stands. */
const FOOT = -1.7;
const HINGE = [FOOT, 0, 0] as const;

/** How far up the plane from its hinge the block starts, and the share of the plane its whole rise takes. */
const START = INCLINE.long * 0.08;
const SHARE = 0.78;

/** Where the block waits on the plane before a frame places it. */
const WAITING = [START, 0, 0] as const;

/** The block: how wide, tall and deep it is. */
const BLOCK = { deep: 0.34, tall: 0.26, wide: 0.36 } as const;

/** How far in front of the middle of the block its forces are drawn: on its face toward the reader. */
const FRONT = BLOCK.deep / 2 + 0.02;

/** How long the two forces down the slope are drawn together. */
const FORCES = 1;

/** How tall the letters of the teaching layer are, in the units of the rig. */
const LETTER = 0.15;

/** Where the camera looks from: straight on and a little above. Its distance is fitted to the frame. */
const VIEW = [0.08, 0.14, 1] as const;

/** How far in from its high end the plane rests on the clamp of the stand. */
const REST = 0.25;

/**
 * An inclined plane on the bench: a deep beech board hinged in brass to a
 * base board and held at its angle by the clamp of a retort stand, with a
 * scale in metres up its side from the mark the block starts at. The block
 * slides up from that mark, slowing at the steady rate the lab computes,
 * rests where the scale reads the distance, and starts again. While it
 * rises, the part of its weight along the slope and the friction are drawn
 * from its downhill end down the slope, each as long as its force.
 */
export function InclineScene({
  angle,
  mass,
  slide,
  speed,
}: {
  /** The plane's angle to the horizontal, in degrees. */
  readonly angle: number;
  /** The block's mass, in kilograms. */
  readonly mass: number;
  /** The forces down the slope in newtons, the deceleration in m s⁻² and the distance the block rises in metres. */
  readonly slide: {
    readonly along: number;
    readonly deceleration: number;
    readonly distance: number;
    readonly friction: number;
  };
  /** The block's speed up the plane when it is released, in m s⁻¹. */
  readonly speed: number;
}) {
  const ink = useLabelInk();
  const format = usePrintNumber();
  const quantity = useQuantity();
  const body = useRef<Group>(null);
  const shown = useRef(true);
  const [rising, setRising] = useState(true);
  const rise = speed / slide.deceleration;
  // The clock starts with the block partway up, so a paused card still shows the forces on it.
  const clock = useSimulationClock(rise * 0.35);
  const turn = (angle * Math.PI) / 180;
  const metre = (INCLINE.long * SHARE) / slide.distance;
  const newton = FORCES / (slide.along + slide.friction);
  const top = [
    FOOT + INCLINE.long * Math.cos(turn),
    INCLINE.base + INCLINE.long * Math.sin(turn),
  ] as const;
  const frame = useMemo(
    () => ({
      x: { max: top[0] + 0.37, min: FOOT - 0.2 },
      y: { max: Math.max(top[1] + 0.35, 1), min: 0 },
      z: { max: INCLINE.deep / 2 + 0.06, min: -INCLINE.deep / 2 - 0.06 },
    }),
    [top[0], top[1]]
  );
  const weight = useMemo(
    () =>
      [
        [-BLOCK.wide / 2, BLOCK.tall * 0.8, FRONT],
        [-BLOCK.wide / 2 - slide.along * newton, BLOCK.tall * 0.8, FRONT],
      ] as const,
    [newton, slide.along]
  );
  const drag = useMemo(
    () =>
      [
        [-BLOCK.wide / 2, BLOCK.tall * 0.3, FRONT],
        [-BLOCK.wide / 2 - slide.friction * newton, BLOCK.tall * 0.3, FRONT],
      ] as const,
    [newton, slide.friction]
  );

  useFrame((_, delta) => {
    const time = clock.advance(delta) % (rise + HOLD_SECONDS);
    const climbing = Math.min(time, rise);
    body.current?.position.setX(
      START +
        (speed * climbing - 0.5 * slide.deceleration * climbing ** 2) * metre
    );
    if (time < rise !== shown.current) {
      shown.current = time < rise;
      setRising(shown.current);
    }
  });

  return (
    <group>
      <CameraControls
        cameraPosition={VIEW}
        cameraTarget={[0, 1, 0]}
        fov={24}
        framing="content"
        maxPolarAngle={Math.PI * 0.49}
        minDistance={0.25}
      />
      <CameraBounds bounds={frame}>
        <group>
          <group position={[top[0] + 0.42 - REST, 0, 0]}>
            <Stand
              height={
                top[1] - (REST + 0.05) * Math.tan(turn) - 0.016 / Math.cos(turn)
              }
              reach={0.37}
              tall={Math.max(top[1] + 0.35, 1)}
            />
          </group>
          <Letter
            color={ink}
            position={[
              FOOT + (INCLINE.arc + 0.22) * Math.cos(turn / 2),
              INCLINE.base + (INCLINE.arc + 0.22) * Math.sin(turn / 2) - 0.02,
              INCLINE.deep / 2 + 0.03,
            ]}
            size={LETTER}
          >
            <InlineMath math={quantity(angle, "^\\circ", 0)} />
          </Letter>
          <group position={HINGE}>
            <Incline
              angle={angle}
              ink={ink}
              scale={{ distance: slide.distance, metre, start: START }}
            >
              <group position={WAITING} ref={body}>
                <Block
                  eye={BLOCK.tall / 2}
                  size={BLOCK}
                  stamp={`${format(mass, 0)} kg`}
                  wood="beech"
                />
                {rising ? (
                  <group>
                    <Force
                      color={PLOT_COLORS.pink}
                      from={weight[0]}
                      size={LETTER}
                      to={weight[1]}
                    >
                      <InlineMath math="W_{\parallel}" />
                    </Force>
                    <Force
                      color={PLOT_COLORS.orange}
                      from={drag[0]}
                      size={LETTER}
                      to={drag[1]}
                    >
                      <InlineMath math="f" />
                    </Force>
                  </group>
                ) : null}
              </group>
            </Incline>
          </group>
        </group>
      </CameraBounds>
    </group>
  );
}
