import { useFrame, useThree } from "@react-three/fiber";
import {
  AxonCore,
  CutFace,
  Myelin,
} from "@repo/design-system/components/contents/biology/neuron/axon";
import type { Fibre } from "@repo/design-system/components/contents/biology/neuron/conduction";
import { potentialAt } from "@repo/design-system/components/contents/biology/neuron/conduction";
import { Clipping } from "@repo/design-system/components/contents/biology/neuron/course";
import { Dendrites } from "@repo/design-system/components/contents/biology/neuron/dendrite";
import { Electrode } from "@repo/design-system/components/contents/biology/neuron/electrode";
import type { Clock } from "@repo/design-system/components/contents/biology/neuron/impulse";
import {
  BareGlow,
  ImpulseContext,
  Ions,
  NodeGlows,
} from "@repo/design-system/components/contents/biology/neuron/impulse";
import { PartLabels } from "@repo/design-system/components/contents/biology/neuron/labels";
import {
  Muscle,
  Terminals,
} from "@repo/design-system/components/contents/biology/neuron/muscle";
import {
  arrival,
  ELECTRODE,
  realTime,
  timeline,
} from "@repo/design-system/components/contents/biology/neuron/playback";
import { Remak } from "@repo/design-system/components/contents/biology/neuron/remak";
import { Soma } from "@repo/design-system/components/contents/biology/neuron/soma";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { useLayoutEffect, useMemo, useRef } from "react";

/**
 * A motor neuron from its dendrites to the end plates on its muscle fibres,
 * drawn at 10 µm to a unit across and shortened along the axon, with the
 * impulse the card plays.
 */
export function NeuronScene({
  fibre,
  length,
  onPotential,
  parts,
}: {
  readonly fibre: Fibre;
  readonly length: number;
  readonly onPotential: (potential: number) => void;
  readonly parts: Readonly<{
    axon: string;
    dendrite: string;
    myelin: string;
    node: string;
    soma: string;
    terminal: string;
  }>;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const run = useMemo(() => timeline(fibre, length), [fibre, length]);
  const clock = useRef<Clock>({
    real: realTime(run, run.still),
    shown: run.still,
  });
  const sent = useRef<number | null>(null);
  const started = useRef(false);
  const impulse = useMemo(() => ({ clock, fibre, length }), [fibre, length]);

  useLayoutEffect(() => {
    clock.current = { real: realTime(run, run.still), shown: run.still };
    sent.current = null;
    started.current = false;
    invalidate();
  }, [invalidate, run]);

  // The first Play after the still frame starts the run from rest, so the
  // impulse is seen to leave the hillock; later ones resume where it paused.
  useFrame((_, delta) => {
    const from = playing && !started.current ? 0 : clock.current.shown;
    started.current = started.current || playing;
    const shown = from + (playing ? simulationStep(delta) : 0);
    const now = realTime(run, shown);
    clock.current = { real: now, shown };
    const reading = Math.round(
      potentialAt(now - arrival(fibre, length, ELECTRODE))
    );
    if (reading !== sent.current) {
      sent.current = reading;
      onPotential(reading);
    }
  }, -1);

  return (
    <ImpulseContext value={impulse}>
      <SimulationTicker running={playing} />
      <Clipping />
      <NeuronCamera />
      <Soma />
      <Dendrites />
      <AxonCore myelinated={fibre.myelinated} />
      {fibre.myelinated && <Myelin />}
      {fibre.myelinated && <CutFace side="near" />}
      {fibre.myelinated && <CutFace side="far" />}
      {!fibre.myelinated && <Remak />}
      <Electrode myelinated={fibre.myelinated} />
      <PartLabels myelinated={fibre.myelinated} parts={parts} />
      {fibre.myelinated ? <NodeGlows /> : <BareGlow />}
      <Ions />
      <Terminals />
      <Muscle />
    </ImpulseContext>
  );
}

/** Looks at the whole neuron from the front and a little above, farther back on a narrow card. */
function NeuronCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 62 : 52;
  return (
    <CameraControls
      cameraPosition={narrow ? [0.5, 8, distance] : [0, 8, distance]}
      cameraTarget={narrow ? [0.3, -1, 0] : [-0.5, -0.8, 0]}
      fov={36}
      maxDistance={distance * 1.8}
      minDistance={6}
    />
  );
}
