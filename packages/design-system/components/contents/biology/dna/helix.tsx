import {
  HelixCamera,
  HelixScene,
} from "@repo/design-system/components/contents/biology/dna/scene";
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
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
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
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

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
  const quantity = useQuantity();
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
              readout={<InlineMath math={quantity(share * 100, "\\%", 0)} />}
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
        <ScienceStage reach={6} setting="cell">
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
