import { useFrame } from "@react-three/fiber";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import {
  Chip,
  Led,
  Toggle,
} from "@repo/design-system/components/contents/physics/electronics/parts";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Matter } from "@repo/design-system/components/three/matter/material";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { CIRCUIT_COLORS } from "@repo/design-system/lib/material/circuit";
import { Array as Arr, Schema } from "effect";
import { useRef, useState } from "react";

/** How long the trainer holds each row of the table, in seconds. */
const ROW_SECONDS = 1.6;

const DECK = 0.11;
const INPUTS = [
  { key: "a", name: "A", z: -0.36 },
  { key: "b", name: "B", z: -0.08 },
  { key: "c", name: "C", z: 0.3 },
] as const;
const STANDOFFS = [
  [-1.02, -0.62],
  [1.02, -0.62],
  [-1.02, 0.62],
  [1.02, 0.62],
] as const;
/** The etched copper tracks of the board: each one's middle, length and depth, and its turn about the vertical. */
const TRACKS = [
  { at: [-0.5, -0.36], size: [0.5, 0.03], turn: 0 },
  { at: [-0.5, -0.08], size: [0.5, 0.03], turn: 0 },
  { at: [0.1, -0.22], size: [0.2, 0.03], turn: 0 },
  { at: [0.32, -0.08], size: [0.3, 0.03], turn: Math.PI / 2 },
  { at: [-0.2, 0.3], size: [1.1, 0.03], turn: 0 },
  { at: [0.84, 0.18], size: [0.22, 0.03], turn: 0 },
] as const;

/** One row of the truth table as the trainer reads it: its inputs, and the outputs the circuit gives for them. */
const ReadingSchema = Schema.Struct({
  a: Schema.Finite,
  b: Schema.Finite,
  c: Schema.Finite,
  /** Whether the chosen gate reproduces the row's given output. */
  match: Schema.Boolean,
  q: Schema.Finite,
  x: Schema.Finite,
});
type Reading = typeof ReadingSchema.Type;

/**
 * The logic trainer: a circuit board on brass standoffs with three input
 * switches and their lamps, the chip of gate P, a lamp on its output X, the
 * NAND chip that takes X and C, and a lamp on the output Q. Along the front
 * one lamp for each row of the table shows green where the chosen gate
 * reproduces the row and red where it does not. While the card plays the
 * trainer steps through the rows, and the lamp of the row it shows is raised.
 */
export function LogicGateScene({
  readings,
}: {
  readonly readings: readonly Reading[];
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const clock = useRef(0);
  const [step, setStep] = useState(0);
  const index = step % Math.max(readings.length, 1);
  const row = readings[index];

  useVisualStop(() => {
    clock.current = 0;
    setStep(0);
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current += simulationStep(delta);
    const next = Math.floor(clock.current / ROW_SECONDS);
    if (next !== step) {
      setStep(next);
    }
  });

  if (row === undefined) {
    return null;
  }

  return (
    <group>
      <BenchCamera
        narrow={[0, 3.1, 4.6]}
        target={[0, 0.2, 0.05]}
        wide={[0, 1.75, 2.6]}
      />
      {Arr.map(STANDOFFS, ([x, z]) => (
        <mesh castShadow key={`${x}:${z}`} position={[x, 0.045, z]}>
          <cylinderGeometry args={[0.03, 0.03, 0.09, 6]} />
          <Matter of="brass" />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[2.2, 0.03, 1.4]} />
        <Matter color={CIRCUIT_COLORS.mask} of="epoxy" />
      </mesh>
      <group position={[0, DECK + 0.006, 0]}>
        {Arr.map(TRACKS, (track) => (
          <mesh
            key={`${track.at[0]}:${track.at[1]}`}
            position={[track.at[0], 0, track.at[1]]}
            rotation={[0, track.turn, 0]}
          >
            <boxGeometry args={[track.size[0], 0.004, track.size[1]]} />
            <Matter color={CIRCUIT_COLORS.maskOverCopper} of="epoxy" />
          </mesh>
        ))}
        {Arr.map(INPUTS, (input) => (
          <group key={input.key} position={[-0.86, 0, input.z]}>
            <Toggle on={row[input.key] === 1} />
            <group position={[0.2, 0, 0]}>
              <Led color={APPARATUS_COLORS.ledRed} lit={row[input.key] === 1} />
            </group>
            <Tag position={[-0.2, 0.2, 0]}>
              <InlineMath math={`${input.name}=${row[input.key]}`} />
            </Tag>
          </group>
        ))}
        <group position={[-0.1, 0, -0.22]}>
          <Chip>
            <Tag position={[0, 0.32, 0]}>
              <InlineMath math="P" />
            </Tag>
          </Chip>
        </group>
        <group position={[0.32, 0, -0.34]}>
          <Led color={APPARATUS_COLORS.ledAmber} lit={row.x === 1} />
          <Tag position={[0.02, 0.36, 0]}>
            <InlineMath math={`X=${row.x}`} />
          </Tag>
        </group>
        <group position={[0.5, 0, 0.18]}>
          <Chip>
            <Tag position={[0, 0.32, 0]}>
              <InlineMath math="\text{NAND}" />
            </Tag>
          </Chip>
        </group>
        <group position={[0.92, 0, 0.18]}>
          <Led color={APPARATUS_COLORS.ledGreen} lit={row.q === 1} />
          <Tag position={[0.04, 0.36, 0]}>
            <InlineMath math={`Q=${row.q}`} />
          </Tag>
        </group>
        {Arr.map(readings, (reading, position) => (
          <group
            key={`${reading.a}${reading.b}${reading.c}`}
            position={[
              (position - (readings.length - 1) / 2) * 0.22,
              position === index ? 0.05 : 0,
              0.56,
            ]}
            scale={0.8}
          >
            <Led
              color={
                reading.match
                  ? APPARATUS_COLORS.ledGreen
                  : APPARATUS_COLORS.ledRed
              }
              lit={position === index}
            />
          </group>
        ))}
      </group>
    </group>
  );
}
