import { useFrame, useThree } from "@react-three/fiber";
import { Blood } from "@repo/design-system/components/contents/biology/heart/blood";
import type { Beat } from "@repo/design-system/components/contents/biology/heart/cycle";
import { momentAt } from "@repo/design-system/components/contents/biology/heart/cycle";
import {
  createPose,
  PulseProvider,
  setPose,
} from "@repo/design-system/components/contents/biology/heart/pulse";
import {
  Coronaries,
  Specimen,
} from "@repo/design-system/components/contents/biology/heart/specimen";
import { HeartValves } from "@repo/design-system/components/contents/biology/heart/valves";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";

/** How often, in seconds, a playing heart tells the card where it is in the beat, so its readouts follow. */
const REPORT = 0.15;

/**
 * A human heart cut open from the front, beating through the cycle of
 * `beat` in real time while the card plays. The card's own time in the
 * beat (`time`) sets where a still heart stands, and a playing heart hands
 * its time back through `onTime` a few times a second.
 */
export function HeartScene({
  beat,
  onTime,
  time,
}: {
  readonly beat: Beat;
  readonly onTime: (time: number) => void;
  readonly time: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const pose = useMemo(createPose, []);
  const clock = useRef(time);
  const sent = useRef(time);
  const since = useRef(0);
  const filled = useMemo(
    () => Math.max(...Arr.map(beat.moments, (moment) => moment.volume)),
    [beat]
  );

  // A time the card set while still moves the clock; one the clock sent is already on it.
  if (!playing && time !== sent.current) {
    clock.current = time;
    sent.current = time;
  }

  useFrame((_, delta) => {
    if (playing) {
      clock.current = (clock.current + simulationStep(delta)) % beat.period;
      since.current += delta;
      if (since.current >= REPORT) {
        since.current = 0;
        sent.current = clock.current;
        onTime(clock.current);
      }
    }
    setPose(pose, momentAt(beat, clock.current), beat, filled);
  });

  return (
    <PulseProvider beat={beat} clock={clock} filled={filled} pose={pose}>
      <SimulationTicker running={playing} />
      <HeartCamera />
      <Specimen />
      <Coronaries />
      <HeartValves />
      <Blood />
    </PulseProvider>
  );
}

/** Looks at the heart from the front, from farther back on a narrow card. */
function HeartCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 37 : 31;
  return (
    <CameraControls
      cameraPosition={[0.6, 1.6, distance]}
      cameraTarget={[0.4, 1.4, 0]}
      fov={34}
      maxDistance={distance * 1.6}
      minDistance={12}
    />
  );
}
