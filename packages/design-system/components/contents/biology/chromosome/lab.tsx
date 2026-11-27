"use client";

import type { Level } from "@repo/design-system/components/contents/biology/chromosome/packing";
import {
  formatDnaLength,
  stretchedLengthMm,
  widthNm,
} from "@repo/design-system/components/contents/biology/chromosome/packing";
import { ChromosomeScene } from "@repo/design-system/components/contents/biology/chromosome/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface ChromosomePackingLabProps {
  readonly basePairs: number;
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly length?: NonNullable<ReactNode>;
    readonly level: string;
    readonly levels: Readonly<Partial<Record<Level, string>>>;
    readonly parts: Readonly<
      Record<
        "phosphate" | "sugar" | "base" | "histone" | "chromatid" | "centromere",
        string
      >
    >;
    readonly view: string;
    readonly width: NonNullable<ReactNode>;
  };
  readonly levels: readonly [Level, ...Level[]];
  readonly title: NonNullable<ReactNode>;
}

/**
 * Interactive DNA packaging workbench scaling from a 1 nm nucleotide through
 * double helix, nucleosome, and 30 nm chromatin fibre to a 700 nm metaphase
 * chromosome.
 */
export function ChromosomePackingLab({
  basePairs,
  description,
  labels,
  levels,
  title,
}: ChromosomePackingLabProps) {
  const [level, setLevel] = useState<Level>(levels[0]);

  const width = widthNm(level);
  const lengthLabel = formatDnaLength(stretchedLengthMm(basePairs));
  const quantity = useQuantity();

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset onReset={() => setLevel(levels[0])} />

      <VisualCardToolbar>
        {levels.length > 1 && (
          <ToggleGroup
            aria-label={labels.level}
            onValueChange={(next) => {
              if (
                next === "nucleotide" ||
                next === "helix" ||
                next === "nucleosome" ||
                next === "fibre" ||
                next === "chromosome"
              ) {
                setLevel(next);
              }
            }}
            size="sm"
            type="single"
            value={level}
          >
            {Arr.map(levels, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.levels[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={1.9} setting="cell">
          <Suspense fallback={null}>
            <ChromosomeScene level={level} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.width}
            value={<InlineMath math={quantity(width, "\\text{ nm}", 0)} />}
          />
          {labels.length !== undefined && (
            <VisualFactTabular label={labels.length} value={lengthLabel} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
