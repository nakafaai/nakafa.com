import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  Backbone,
  NewStrands,
} from "@repo/design-system/components/contents/biology/dna/backbone";
import { ladderOf } from "@repo/design-system/components/contents/biology/dna/ladder";
import {
  BaseGlow,
  Pair,
} from "@repo/design-system/components/contents/biology/dna/pair";
import type {
  Base,
  Nucleic,
} from "@repo/design-system/components/contents/biology/dna/strand";
import {
  basesOf,
  copiedCount,
  differencesOf,
  gcShareOf,
  identityOf,
  spanOf,
  turnsOf,
} from "@repo/design-system/components/contents/biology/dna/strand";
import { DEFAULT_CYCLE_HOLD } from "@repo/design-system/components/contents/simulation/clock";
import type { CycleState } from "@repo/design-system/components/contents/simulation/cycle";
import {
  quantizeCycle,
  stepCycle,
} from "@repo/design-system/components/contents/simulation/cycle";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  useVisualReset,
  useVisualScene,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";

/** A card narrower than this width-to-height ratio gets the farther camera. */
const NARROW_ASPECT = 1.2;

/** Played, copying a stretch takes ten seconds. */
const COPY_SECONDS = 10;

/**
 * A stretch of DNA or RNA built base by base at B-DNA's real geometry: 0.34 nm
 * per base pair, 10.5 pairs a turn, 2 nm across, with its minor and major
 * grooves. With a `variant`, the reader switches between two sequences and
 * the changed bases glow; with `copy`, a slider opens the helix from one end
 * and new nucleotides pair with both parents, as in replication. An RNA
 * genome stands as one strand until it is copied.
 */
export function DnaHelixLab({
  copy = false,
  description,
  genome,
  labels,
  nucleic = "dna",
  sequence,
  title,
  variant,
}: {
  readonly copy?: boolean;
  readonly description: NonNullable<ReactNode>;
  readonly genome?: number;
  readonly labels: {
    readonly choose?: string;
    readonly copied?: ReactNode;
    readonly copy?: string;
    readonly differences?: ReactNode;
    readonly gc?: ReactNode;
    readonly identity?: ReactNode;
    readonly share?: ReactNode;
    readonly whole?: ReactNode;
    readonly length: ReactNode;
    readonly span: ReactNode;
    readonly strands?: Readonly<{ first: ReactNode; second: ReactNode }>;
    readonly turns?: ReactNode;
    readonly viewLabel: string;
  };
  readonly nucleic?: Nucleic;
  readonly sequence: string;
  readonly title: NonNullable<ReactNode>;
  readonly variant?: string;
}) {
  const [shown, setShown] = useState<"first" | "second">("first");
  const [share, setShare] = useState(copy ? 0.5 : 0);
  const first = useMemo(() => basesOf(sequence, nucleic), [nucleic, sequence]);
  const second = useMemo(
    () => (variant === undefined ? first : basesOf(variant, nucleic)),
    [first, nucleic, variant]
  );
  const bases = shown === "first" ? first : second;
  const changed = useMemo(
    () => Arr.map(bases, (_, index) => second[index] !== first[index]),
    [bases, first, second]
  );

  return (
    <VisualCard
      onReset={() => {
        setShown("first");
        setShare(copy ? 0.5 : 0);
      }}
    >
      <VisualCardHeader description={description} title={title} />

      {(variant !== undefined || copy) && (
        <VisualCardToolbar>
          {variant !== undefined && labels.strands && (
            <ToggleGroup
              aria-label={labels.choose}
              onValueChange={(value: string) =>
                setShown(value === "second" ? "second" : "first")
              }
              type="single"
              value={shown}
              variant="outline"
            >
              <ToggleGroupItem value="first">
                {labels.strands.first}
              </ToggleGroupItem>
              <ToggleGroupItem value="second">
                {labels.strands.second}
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          {copy && (
            <VisualSlider
              heading={labels.copy}
              label={labels.copy ?? ""}
              max={1}
              min={0}
              onValueChange={setShare}
              pauseOnChange
              readout={`${Math.round(share * 100)}%`}
              step={0.01}
              value={share}
            />
          )}
        </VisualCardToolbar>
      )}

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={6} setting="studio">
          <HelixCamera />
          <HelixScene
            bases={bases}
            changed={changed}
            copy={copy}
            nucleic={nucleic}
            onShare={setShare}
            share={copy ? share : 0}
          />
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <HelixFacts
          bases={bases}
          copy={copy}
          first={first}
          labels={labels}
          nucleic={nucleic}
          second={variant === undefined ? undefined : second}
          share={share}
        >
          {nucleic === "rna" && !copy && genome !== undefined && (
            <GenomeFacts
              count={bases.length}
              genome={genome}
              share={labels.share}
              whole={labels.whole}
            />
          )}
        </HelixFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The footer's readings. Every card counts its bases; double-stranded DNA
 * gives its length at 0.34 nm a pair, then the differences between two
 * sequences, the copying progress, or its turns and G and C share. A single
 * RNA strand has no fixed rise or turn, so it gives its G and C share. The
 * lab composes what follows them as children.
 */
function HelixFacts({
  bases,
  children,
  copy,
  first,
  labels,
  nucleic,
  second,
  share,
}: {
  readonly bases: readonly Base[];
  readonly children: ReactNode;
  readonly copy: boolean;
  readonly first: readonly Base[];
  readonly labels: Readonly<{
    copied?: ReactNode;
    differences?: ReactNode;
    gc?: ReactNode;
    identity?: ReactNode;
    length: ReactNode;
    share?: ReactNode;
    span?: ReactNode;
    turns?: ReactNode;
    whole?: ReactNode;
  }>;
  readonly nucleic: Nucleic;
  readonly second: readonly Base[] | undefined;
  readonly share: number;
}) {
  const quantity = useQuantity();
  const count = bases.length;
  const single = nucleic === "rna" && !copy;
  return (
    <VisualCardFacts>
      <VisualFactTabular
        label={labels.length}
        value={<InlineMath math={quantity(count, "", 0)} />}
      />
      {!single && (
        <VisualFactTabular
          label={labels.span}
          value={
            <InlineMath math={quantity(spanOf(count), "\\text{ nm}", 1)} />
          }
        />
      )}
      {second !== undefined && (
        <>
          <VisualFactTabular
            label={labels.differences}
            value={
              <InlineMath
                math={quantity(differencesOf(first, second), "", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.identity}
            value={
              <InlineMath
                math={quantity(identityOf(first, second) * 100, "\\%", 1)}
              />
            }
          />
        </>
      )}
      {second === undefined && copy && (
        <VisualFactTabular
          label={labels.copied}
          value={
            <InlineMath math={quantity(copiedCount(count, share), "", 0)} />
          }
        />
      )}
      {second === undefined && !single && (
        <VisualFactTabular
          label={labels.turns}
          value={<InlineMath math={quantity(turnsOf(count), "", 1)} />}
        />
      )}
      {second === undefined && !copy && (
        <VisualFactTabular
          label={labels.gc}
          value={
            <InlineMath math={quantity(gcShareOf(bases) * 100, "\\%", 0)} />
          }
        />
      )}
      {children}
    </VisualCardFacts>
  );
}

/**
 * The strand or strands, their bases and the sequence written along them.
 * Played, the helix spins on its axis; a copying card runs its progress
 * instead and hands it to the card.
 */
function HelixScene({
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
  const ladder = useMemo(
    () => ladderOf(bases.length, share),
    [bases.length, share]
  );
  const single = nucleic === "rna";
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

  return (
    <group position={[-middle, 0, 0]}>
      <group ref={spin}>
        <Backbone
          color={CELL_COLORS.phosphate}
          points={Arr.map(ladder, (rung) => rung.first)}
        />
        {!(single && share === 0) && (
          <Backbone
            color={single ? CELL_COLORS.phosphateNew : CELL_COLORS.phosphate}
            points={Arr.map(ladder, (rung) => rung.second)}
          />
        )}
        <NewStrands ladder={ladder} />
        {Arr.map(ladder, (rung) => (
          <BaseGlow key={rung.index} value={changed[rung.index] === true}>
            <Pair
              base={bases[rung.index] ?? "A"}
              nucleic={nucleic}
              rung={rung}
              single={single}
            />
          </BaseGlow>
        ))}
      </group>
      {Arr.map(ladder, (rung) => (
        <ThreeLabel
          color={ink}
          fontSize="compact"
          key={rung.index}
          position={[rung.index * 0.34, rung.open ? 3.2 : 1.7, 0]}
        >
          {bases[rung.index]}
        </ThreeLabel>
      ))}
    </group>
  );
}

/**
 * The camera on the helix: farther back on a narrow card, such as a phone's
 * square frame, so the whole stretch and its letters stay in view.
 */
function HelixCamera() {
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

/** How much of a whole genome a single strand's stretch shows: the genome's bases and the stretch's share of them. */
function GenomeFacts({
  count,
  genome,
  share,
  whole,
}: {
  readonly count: number;
  readonly genome: number;
  readonly share: ReactNode;
  readonly whole: ReactNode;
}) {
  const quantity = useQuantity();
  return (
    <>
      <VisualFactTabular
        label={whole}
        value={<InlineMath math={quantity(genome, "", 0)} />}
      />
      <VisualFactTabular
        label={share}
        value={<InlineMath math={quantity((count / genome) * 100, "\\%", 2)} />}
      />
    </>
  );
}
