import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { Stand } from "@repo/design-system/components/contents/physics/bench/stand";
import { ruleSheet } from "@repo/design-system/components/contents/physics/mechanics/springs/scale";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Letter } from "@repo/design-system/components/three/apparatus/force";
import { Hanger } from "@repo/design-system/components/three/apparatus/hanger";
import {
  BAR_TALL,
  Bar,
  Clip,
  Link,
} from "@repo/design-system/components/three/apparatus/hardware";
import { Rule } from "@repo/design-system/components/three/apparatus/rule";
import { Spring } from "@repo/design-system/components/three/apparatus/spring";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/** The natural length of each spring, in centimetres. */
const NATURAL = 10;

/** How high the top hook of spring P hangs, and how tall the stretch of two springs and their largest extension is drawn. */
const TOP = 2.7;
const SPAN = 1.72;

/** The radius of a spring's coils and of its wire, and how many turns it makes. */
const COIL = { radius: 0.07, turns: 14, wire: 0.008 } as const;

/** How thick and how long the bars between the springs are, and how far from the middle Q and R hang. */
const BAR = { long: 0.66, tall: BAR_TALL } as const;
const APART = 0.23;

/** How tall the letters of the teaching layer are, in the units of the rig. */
const LETTER = 0.13;

/** Where the camera looks from: straight on, a little above and to the right. Its distance is fitted to the frame. */
const VIEW = [0.1, 0.08, 1] as const;

/** What the camera frames: the rule, the springs at any load, and the stand. */
const FRAME = {
  x: { max: 1.1, min: -1.05 },
  y: { max: TOP + 0.32, min: -0.14 },
  z: { max: 0.25, min: -0.25 },
} as const;

/** How far the eye of a spring or a hanger sits into the hole of the bar it hooks through. */
const SEAT = 0.02;

/** How far the pointer of a clip reaches from the rule toward the springs. */
const CLIP = 0.36;

/** Where the rule stands, and how wide it is. */
const RULE = { at: -0.78, wide: 0.13 } as const;

/**
 * Spring P hangs by a link from the arm of a retort stand and carries a bar with springs Q and
 * R side by side, which carry a second bar and the load: a hanger with one
 * stack of slotted masses that make up the load. Each spring is as long as its natural
 * length and the extension the lab computes for it, to the scale of the
 * rule beside them, whose teal clip marks where the lower bar hangs with no
 * load and whose pink clip follows it down.
 */
export function SpringScene({
  load,
  most,
  pair,
  top,
}: {
  /** The load on the hanger, in newtons. */
  readonly load: number;
  /** The largest total extension the lab reaches, in centimetres. */
  readonly most: number;
  /** The extension of each of Q and R, in centimetres. */
  readonly pair: number;
  /** The extension of P, in centimetres. */
  readonly top: number;
}) {
  const format = usePrintNumber();
  const ink = useLabelInk();
  const unit = SPAN / (2 * NATURAL + most);
  const first = TOP - (NATURAL + top) * unit;
  const second = first - BAR.tall - (NATURAL + pair) * unit;
  const rest = TOP - 2 * NATURAL * unit - BAR.tall;
  const scale = useMemo(
    () =>
      ruleSheet(
        { long: TOP - 0.06, unit, wide: RULE.wide },
        INSTRUMENT_COLORS.graphite,
        format
      ),
    [format, unit]
  );

  return (
    <group>
      <CameraControls
        cameraPosition={VIEW}
        cameraTarget={[0, TOP / 2, 0]}
        fov={36}
        framing="content"
        maxPolarAngle={Math.PI * 0.49}
        minDistance={0.25}
      />
      <CameraBounds bounds={FRAME}>
        <group>
          <group position={[0.8, 0, 0]}>
            <Stand height={TOP + 0.07} reach={0.85} tall={TOP + 0.32} />
          </group>
          <group position={[0, TOP, 0]}>
            <Link />
          </group>
          <group position={[0, TOP, 0]}>
            <Spring coil={COIL} length={(NATURAL + top) * unit + SEAT} />
          </group>
          <group position={[0, first, 0]}>
            <Bar long={BAR.long} />
          </group>
          {Arr.map([-APART, APART], (x) => (
            <group key={x} position={[x, first - BAR.tall + SEAT, 0]}>
              <Spring coil={COIL} length={(NATURAL + pair) * unit + SEAT * 2} />
            </group>
          ))}
          <group position={[0, second, 0]}>
            <Bar long={BAR.long} />
            <group position={[0, SEAT * 0.7 - BAR.tall, 0]}>
              <Hanger load={load} />
            </group>
          </group>
          <group position={[RULE.at, 0, 0]}>
            <Rule sheet={scale} stands="end" />
          </group>
          <group position={[RULE.at + RULE.wide / 2, rest, 0.02]}>
            <Clip color={PLOT_COLORS.teal} reach={CLIP} />
          </group>
          <group position={[RULE.at + RULE.wide / 2, second, 0.02]}>
            <Clip color={PLOT_COLORS.pink} reach={CLIP} />
          </group>
          <Letter
            color={ink}
            position={[0.17, (TOP + first) / 2, 0]}
            size={LETTER}
          >
            <InlineMath math="P" />
          </Letter>
          <Letter
            color={ink}
            position={[-APART - 0.17, (first + second) / 2, 0]}
            size={LETTER}
          >
            <InlineMath math="Q" />
          </Letter>
          <Letter
            color={ink}
            position={[APART + 0.17, (first + second) / 2, 0]}
            size={LETTER}
          >
            <InlineMath math="R" />
          </Letter>
        </group>
      </CameraBounds>
    </group>
  );
}
