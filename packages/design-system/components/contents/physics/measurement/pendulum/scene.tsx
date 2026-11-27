import { useFrame } from "@react-three/fiber";
import {
  BobSchema,
  STRING_RANGE,
  swingAngle,
  swingReach,
} from "@repo/design-system/components/contents/physics/measurement/pendulum/period";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Bob } from "@repo/design-system/components/three/instrument/bob";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import { Gantry } from "@repo/design-system/components/three/instrument/stand";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr, Match } from "effect";
import { useRef } from "react";

/** One of the three bobs. */
type Kind = typeof BobSchema.Type;

/** The radius of the crossbar the threads are tied round, in millimetres. */
const BAR = 5;

/**
 * The radius of every bob, in millimetres. A set made to show that the
 * period does not depend on mass has balls of one size in different
 * materials, so the drag on them and the length to their middle are the
 * same and only the mass differs.
 */
const BALL = 30;

/** How far the lowest bob clears the bench on the longest string, in millimetres. */
const CLEAR = 60;

/** How high the underside of the crossbar is over the bench, in millimetres. */
const RISE = STRING_RANGE.max * 1000 + BALL + CLEAR;

/** How far apart the threads hang, in millimetres: two balls and a gap of one. */
const APART = BALL * 4;

/** How far apart the two stands are, in millimetres: the three threads, and the widest swing clear on either side. */
const WIDE = 2 * (APART + swingReach(STRING_RANGE.max) * 1000 + BALL + 40);

/**
 * What the camera frames at every width for strings `length` metres long,
 * in scene units: the crossbar from rod to rod, and under it every place a
 * bob swings through, down to just under the bobs. On the longest string
 * that reaches the bench and the feet of the stands; on a shorter one the
 * rods run out of the picture at the bottom, so the bobs stay as large as
 * the string allows.
 */
function frameOf(length: number) {
  return {
    x: {
      max: (WIDE / 2 + 20) * MILLIMETRE,
      min: (-WIDE / 2 - 20) * MILLIMETRE,
    },
    y: {
      max: (RISE + 30) * MILLIMETRE,
      min: Math.max(0, RISE - length * 1000 - BALL - 20) * MILLIMETRE,
    },
    z: { max: (BALL + 10) * MILLIMETRE, min: -BALL * MILLIMETRE },
  };
}

/** What a bob is turned or cast from: pale wood, polished brass, or dull lead. */
function Stuff({ kind }: { readonly kind: Kind }) {
  return Match.value(kind).pipe(
    Match.when("wood", () => (
      <SurfaceMaterial
        coat={0.25}
        color={INSTRUMENT_COLORS.pine}
        repeat={[3, 3]}
        roughness={0.55}
        surface="wood"
      />
    )),
    Match.when("brass", () => (
      <SurfaceMaterial
        bump={0.2}
        color={INSTRUMENT_COLORS.brass}
        metalness={1}
        repeat={[6, 3]}
        roughness={0.24}
        surface="brushed"
      />
    )),
    Match.orElse(() => (
      <SurfaceMaterial
        bump={0.5}
        color={INSTRUMENT_COLORS.lead}
        metalness={0.85}
        repeat={[5, 5]}
        roughness={0.62}
        surface="cast"
      />
    ))
  );
}

/**
 * Three pendulums of one length on one gantry, as a bench: a 50 g wooden
 * bob, a 200 g brass bob and a 500 g lead bob, balls of one size as in a
 * real mass-independence set, on threads tied round one crossbar. The
 * camera looks a little up from the bobs, so they are the nearest and
 * largest thing in the picture. While the lab plays they are let
 * go together and swing in real time, and they keep step at every length,
 * because no power of mass enters the period.
 *
 * @param length - From the crossbar to the middle of each bob, in metres
 */
export function SwingScene({ length }: { readonly length: number }) {
  const clock = useSimulationClock();
  const angle = useRef(swingAngle(length, 0));

  useFrame((_, delta) => {
    angle.current = swingAngle(length, clock.advance(delta));
  });

  return (
    <group>
      <CameraControls
        cameraPosition={[1.2, (RISE / 2) * MILLIMETRE - 0.9, 4.6]}
        cameraTarget={[0, (RISE / 2) * MILLIMETRE, 0]}
        fov={50}
        framing="content"
        maxPolarAngle={Math.PI * 0.49}
      />
      <CameraBounds bounds={frameOf(length)}>
        <Gantry rise={RISE} wide={WIDE}>
          {Arr.map(BobSchema.literals, (kind, index) => (
            <group
              key={kind}
              position={[(index - 1) * APART * MILLIMETRE, 0, 0]}
            >
              <Bob
                cord={length * 1000}
                radius={BALL}
                round={BAR}
                swing={() => angle.current}
              >
                <Stuff kind={kind} />
              </Bob>
            </group>
          ))}
        </Gantry>
      </CameraBounds>
    </group>
  );
}
