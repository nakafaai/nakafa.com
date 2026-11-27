import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  forkOf,
  spreadAt,
} from "@repo/design-system/components/contents/biology/dna/fork";
import type {
  Base,
  Nucleic,
} from "@repo/design-system/components/contents/biology/dna/strand";
import { complementOf } from "@repo/design-system/components/contents/biology/dna/strand";
import { DEFAULT_CYCLE_HOLD } from "@repo/design-system/components/contents/simulation/clock";
import type { CycleState } from "@repo/design-system/components/contents/simulation/cycle";
import {
  quantizeCycle,
  stepCycle,
} from "@repo/design-system/components/contents/simulation/cycle";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MoleculeModel } from "@repo/design-system/components/three/molecule/kit";
import type { Step } from "@repo/design-system/components/three/molecule/nucleic";
import { helixOf } from "@repo/design-system/components/three/molecule/nucleic";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualReset,
  useVisualScene,
} from "@repo/design-system/components/visual/card";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { AdditiveBlending } from "three";

/** A card narrower than this width-to-height ratio gets the farther camera. */
const NARROW_ASPECT = 1.2;

/** One angstrom of a molecule in the scene, whose unit is the nanometre. */
const NANOMETRE = 0.1;

/** Each base keeps one colour in every lesson, in the muted tones of a molecular model. */
const BASE_COLORS = {
  A: CELL_COLORS.adenine,
  C: CELL_COLORS.cytosine,
  G: CELL_COLORS.guanine,
  T: CELL_COLORS.thymine,
  U: CELL_COLORS.uracil,
} as const satisfies Record<Base, string>;

/** Played, copying a stretch takes ten seconds. */
const COPY_SECONDS = 10;

/**
 * The strand or strands, their bases and the sequence written along them.
 * Played, the helix spins on its axis; a copying card runs its progress
 * instead and hands it to the card.
 */
export function HelixScene({
  bases,
  changed,
  copy,
  nucleic,
  onShare,
  share,
}: {
  readonly bases: readonly Base[];
  readonly changed: readonly boolean[];
  readonly copy: boolean;
  readonly nucleic: Nucleic;
  readonly onShare: (share: number) => void;
  readonly share: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const spin = useRef<Group>(null);
  const cycle = useRef<CycleState>({ hold: 0, value: share });
  const sent = useRef(share);
  const shownPlaying = useRef(false);
  const [upper, lower] = useMemo(
    () => forkOf(bases, nucleic, share),
    [bases, nucleic, share]
  );
  const middle = ((bases.length - 1) * 0.34) / 2;

  useEffect(() => {
    if (share !== sent.current) {
      cycle.current = { hold: 0, value: share };
      sent.current = share;
      invalidate();
    }
  }, [invalidate, share]);

  useVisualReset(() => {
    const start = copy ? 0.5 : 0;
    cycle.current = { hold: 0, value: start };
    sent.current = start;
    if (spin.current) {
      spin.current.rotation.x = 0;
    }
    invalidate();
  });

  useFrame((_, delta) => {
    if (!playing) {
      shownPlaying.current = false;
      return;
    }
    const step = simulationStep(delta);
    if (!copy) {
      if (spin.current) {
        spin.current.rotation.x += step * 0.5;
      }
      return;
    }
    if (!shownPlaying.current && cycle.current.value >= 1) {
      cycle.current = { hold: 0, value: 0 };
    }
    shownPlaying.current = true;
    cycle.current = stepCycle(cycle.current, {
      deltaSeconds: step,
      holdSeconds: DEFAULT_CYCLE_HOLD,
      rate: 1 / COPY_SECONDS,
      total: 1,
    });
    const shown = quantizeCycle(cycle.current.value, 1, 50);
    if (shown !== sent.current) {
      sent.current = shown;
      onShare(shown);
    }
  });

  const ink = useLabelInk();
  const places = useMemo(
    () =>
      Arr.map(bases, (base, index) => ({
        base,
        changed: changed[index] === true,
        index,
      })),
    [bases, changed]
  );

  return (
    <group position={[-middle, 0, 0]}>
      <group ref={spin}>
        <group rotation={[0, Math.PI / 2, 0]} scale={NANOMETRE}>
          {upper !== undefined && (
            <Duplex
              bases={bases}
              fresh={upper.fresh}
              nucleic={nucleic}
              start={upper.start}
              steps={upper.steps}
            />
          )}
          {lower !== undefined && (
            <Duplex
              bases={bases}
              fresh={lower.fresh}
              nucleic={nucleic}
              start={lower.start}
              steps={lower.steps}
            />
          )}
        </group>
        {Arr.map(
          places,
          (place) =>
            place.changed && (
              <mesh key={place.index} position={[place.index * 0.34, 0, 0]}>
                <sphereGeometry args={[1.05, 24, 16]} />
                <meshBasicMaterial
                  blending={AdditiveBlending}
                  color={BASE_COLORS[place.base]}
                  depthWrite={false}
                  opacity={0.3}
                  transparent
                />
              </mesh>
            )
        )}
      </group>
      {Arr.map(places, (place) => (
        <ThreeLabel
          color={ink}
          fontSize="compact"
          key={place.index}
          position={[
            place.index * 0.34,
            1.7 + spreadAt(place.index, bases.length, share) * NANOMETRE,
            0,
          ]}
        >
          {place.base}
        </ThreeLabel>
      ))}
    </group>
  );
}

/**
 * One molecule of the stretch as a ribbon model: each backbone a tube, the
 * parents' in phosphorus orange and a newly laid one paler, and each
 * nucleotide's sugar and base as sticks in its base's colour.
 */
function Duplex({
  bases,
  fresh,
  nucleic,
  start,
  steps,
}: {
  readonly bases: readonly Base[];
  readonly fresh: readonly boolean[];
  readonly nucleic: Nucleic;
  readonly start: number;
  readonly steps: readonly Step[];
}) {
  const molecule = useMemo(() => helixOf(steps), [steps]);
  const tints = useMemo(
    () =>
      Arr.flatMap(Arr.drop(bases, start), (base) => [
        BASE_COLORS[base],
        BASE_COLORS[complementOf(base, nucleic)],
      ]),
    [bases, nucleic, start]
  );
  const spines = useMemo(
    () =>
      Arr.map(fresh, (laid) =>
        laid ? CELL_COLORS.phosphateNew : CELL_COLORS.phosphate
      ),
    [fresh]
  );
  return (
    <MoleculeModel
      molecule={molecule}
      spines={spines}
      style="ribbon"
      tints={tints}
    />
  );
}

/**
 * The camera on the helix: farther back on a narrow card, such as a phone's
 * square frame, so the whole stretch and its letters stay in view.
 */
export function HelixCamera() {
  const size = useThree((state) => state.size);
  return (
    <CameraControls
      cameraPosition={
        isNarrowThreeScene(size, NARROW_ASPECT) ? [0, 1.6, 20] : [0, 1.6, 14]
      }
      cameraTarget={[0, 0, 0]}
      fov={34}
      maxDistance={30}
      minDistance={4}
    />
  );
}
