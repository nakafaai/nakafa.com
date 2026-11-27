import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { plotSheet } from "@repo/design-system/components/contents/physics/measurement/stopwatch/plot";
import {
  swingAngle,
  TRUE_TIME,
  trialMoment,
  trialTimes,
} from "@repo/design-system/components/contents/physics/measurement/stopwatch/trials";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { ReadingCamera } from "@repo/design-system/components/three/instrument/camera";
import { Pendulum } from "@repo/design-system/components/three/instrument/pendulum";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import { Stopwatch } from "@repo/design-system/components/three/instrument/stopwatch";
import { PrintFace } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr, Option } from "effect";
import { useMemo, useRef, useState } from "react";

/** The pendulum's length, in millimetres. */
const LENGTH = 800;

/** How far back the watch and the results board lean on their blocks, in radians. */
const LEAN = 0.36;

/** A planed pine block that something leans against, in millimetres. */
function Block({
  at,
  wide,
}: {
  readonly at: readonly [number, number, number];
  readonly wide: number;
}) {
  return (
    <group position={[at[0], at[1], at[2]]} scale={MILLIMETRE}>
      <RoundedBox
        args={[wide, 44, 44]}
        castShadow
        position={[0, 22, 0]}
        radius={1.2}
        receiveShadow
        smoothness={3}
      >
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.pine}
          repeat={[wide / 60, 0.8]}
          roughness={0.66}
          surface="wood"
        />
      </RoundedBox>
    </group>
  );
}

/** The results board: a hardboard clipboard with its sprung steel clip, holding the printed dot plot. */
function Board({
  count,
  landed,
}: {
  readonly count: number;
  readonly landed: boolean;
}) {
  const format = usePrintNumber();
  const sheet = useMemo(
    () => plotSheet(trialTimes(count), landed ? count : count - 1, format),
    [count, format, landed]
  );

  return (
    <group scale={MILLIMETRE}>
      <RoundedBox
        args={[206, 128, 3]}
        castShadow
        position={[0, 64, -1.5]}
        radius={1.2}
        receiveShadow
        smoothness={3}
      >
        <SurfaceMaterial
          color={APPARATUS_COLORS.oakDark}
          repeat={[3, 2]}
          roughness={0.7}
          surface="wood"
        />
      </RoundedBox>
      <group position={[0, 56, 0.25]}>
        <PrintFace sheet={sheet} stock="paper" />
      </group>
      <RoundedBox
        args={[74, 15, 5]}
        castShadow
        position={[0, 117, 2.4]}
        radius={1.6}
        smoothness={4}
      >
        <SurfaceMaterial
          bump={0.3}
          color={INSTRUMENT_COLORS.satinChrome}
          metalness={1}
          repeat={[6, 1]}
          roughness={0.5}
          surface="brushed"
        />
      </RoundedBox>
      <mesh castShadow position={[0, 123, 4]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[3.2, 3.2, 62, 24]} />
        <SurfaceMaterial
          bump={0.3}
          color={INSTRUMENT_COLORS.satinChrome}
          metalness={1}
          repeat={[2, 6]}
          roughness={0.5}
          surface="brushed"
        />
      </mesh>
    </group>
  );
}

/**
 * Ten swings of a pendulum timed by hand, as a bench: the pendulum on its
 * stand down the bench, and in front of it the stopwatch and the results
 * board, each leaning on a block. While the lab plays, the latest trial
 * runs: the pendulum swings, the watch counts, and once the thumb stops it
 * the reading joins the plot.
 *
 * @param count - How many trials are recorded
 */
export function TrialScene({ count }: { readonly count: number }) {
  const clock = useSimulationClock();
  const moment = useRef(0);
  const trial = useRef(count);
  const duration = Option.getOrElse(
    Arr.last(trialTimes(count)),
    () => TRUE_TIME
  );
  const [landed, setLanded] = useState(true);

  useFrame((_, delta) => {
    if (trial.current !== count) {
      trial.current = count;
      clock.time.current = 0;
    }
    moment.current = trialMoment(clock.advance(delta), duration);
    const over = moment.current >= duration;
    if (over !== landed) {
      setLanded(over);
    }
  });

  return (
    <group>
      <ReadingCamera
        back={1.6}
        narrow={[0, 1.25, 13.6]}
        target={[0, 1.25, 7.6]}
        wide={[0.1, 1.25, 12.5]}
      />
      <group position={[0.35, 0, -11.9]}>
        <Pendulum length={LENGTH} swing={() => swingAngle(moment.current)} />
      </group>
      <Block at={[-0.5, 0, 7.25]} wide={170} />
      <group position={[-0.5, 0, 7.92]} rotation={[-LEAN, 0, 0]}>
        <Board count={count} landed={landed} />
      </group>
      <Block at={[1.12, 0, 7.4]} wide={70} />
      <group position={[1.12, 0.43, 7.82]} rotation={[-LEAN, 0, 0]}>
        <Stopwatch seconds={() => moment.current} />
      </group>
    </group>
  );
}
