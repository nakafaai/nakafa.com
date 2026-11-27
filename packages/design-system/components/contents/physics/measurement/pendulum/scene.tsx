import { useFrame } from "@react-three/fiber";
import {
  BobSchema,
  bobRadius,
  STRING_RANGE,
  swingAngle,
  swingReach,
} from "@repo/design-system/components/contents/physics/measurement/pendulum/period";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Bob } from "@repo/design-system/components/three/instrument/bob";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import {
  GANTRY_REACH,
  Gantry,
} from "@repo/design-system/components/three/instrument/stand";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr, Match } from "effect";
import { useRef } from "react";

/** One of the three bobs. */
type Kind = typeof BobSchema.Type;

/** The radius of the crossbar the threads are tied round, in millimetres. */
const BAR = 5;

/** How far the lowest bob clears the bench on the longest string, in millimetres. */
const CLEAR = 60;

/** How high the underside of the crossbar is over the bench, in millimetres. */
const RISE = STRING_RANGE.max * 1000 + bobRadius("wood") * 1000 + CLEAR;

/** How far apart the threads hang, in millimetres. */
const APART = 190;

/** How far apart the two stands are, in millimetres: the three threads, and the widest swing clear on either side. */
const WIDE = 2 * (APART + swingReach(STRING_RANGE.max) * 1000 + 70);

/**
 * What the camera frames at every width for strings `length` metres long,
 * in scene units: the crossbar between the two rods, and under it every
 * place a bob swings through, down to just under the bobs. On a short
 * string the feet of the stands run out of the picture, so the bobs stay as
 * large as the string allows.
 */
function frameOf(length: number) {
  return {
    x: {
      max: (WIDE / 2 + 30) * MILLIMETRE,
      min: (-WIDE / 2 - 30) * MILLIMETRE,
    },
    y: {
      max: (RISE + 60) * MILLIMETRE,
      min:
        (RISE - length * 1000 - bobRadius("wood") * 1000 - CLEAR) * MILLIMETRE,
    },
    z: { max: 40 * MILLIMETRE, min: (-GANTRY_REACH - 40) * MILLIMETRE },
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
 * bob, a 200 g brass bob and a 500 g lead bob, each a solid ball of its true
 * size, on threads tied round one crossbar. While the lab plays they are let
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
        cameraPosition={[4.5, 8.6, 24]}
        cameraTarget={[0, (RISE / 2) * MILLIMETRE, 0]}
        fov={36}
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
                radius={bobRadius(kind) * 1000}
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
