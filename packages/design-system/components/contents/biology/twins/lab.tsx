"use client";

import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { TwinsPart } from "@repo/design-system/components/contents/biology/twins/scene";
import { TwinsScene } from "@repo/design-system/components/contents/biology/twins/scene";
import type {
  Kind,
  ResultKey,
} from "@repo/design-system/components/contents/biology/twins/split";
import { twinOutcome } from "@repo/design-system/components/contents/biology/twins/split";
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
import {
  VisualFact,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface TwinsLabProps {
  readonly description: NonNullable<ReactNode>;
  readonly kinds: readonly [Kind, ...Kind[]];
  readonly labels: {
    readonly genes: NonNullable<ReactNode>;
    readonly kind: string;
    readonly kinds: Readonly<Partial<Record<Kind, string>>>;
    readonly parts: Readonly<Record<TwinsPart, string>>;
    readonly placentas: NonNullable<ReactNode>;
    readonly results: Readonly<Record<ResultKey, string>>;
    readonly sacs: NonNullable<ReactNode>;
    readonly sex: NonNullable<ReactNode>;
    readonly split: string;
    readonly view: string;
  };
  readonly split: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}

/**
 * Interactive twin development workbench comparing identical (monozygotic)
 * split timing and fraternal (dizygotic) twin formation, showing placentas,
 * amniotic sacs, genetic identity, sex match, and conjoined status.
 */
export function TwinsLab({
  description,
  kinds,
  labels,
  split,
  title,
}: TwinsLabProps) {
  const [kind, setKind] = useState<Kind>(kinds[0]);
  const [splitDay, setSplitDay] = useState(split.value);

  const outcome = twinOutcome(kind, splitDay);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setKind(kinds[0]);
          setSplitDay(split.value);
        }}
      />

      <VisualCardToolbar>
        {kinds.length > 1 && (
          <ToggleGroup
            aria-label={labels.kind}
            onValueChange={(next) => {
              if (next === "identical" || next === "fraternal") {
                setKind(next);
              }
            }}
            size="sm"
            type="single"
            value={kind}
          >
            {Arr.map(kinds, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.kinds[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {kind === "identical" && (
          <VisualSlider
            heading={labels.split}
            label={labels.split}
            max={split.max}
            min={split.min}
            onValueChange={setSplitDay}
            readout={`${splitDay}`}
            step={1}
            value={splitDay}
          />
        )}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.0} setting="studio">
          <Suspense fallback={null}>
            <TwinsScene kind={kind} parts={labels.parts} splitDay={splitDay} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.placentas}
            value={`${outcome.placentas}`}
          />
          <VisualFactTabular
            label={labels.sacs}
            value={
              outcome.joined
                ? `${outcome.sacs} (${labels.results.joined})`
                : `${outcome.sacs}`
            }
          />
          <VisualFact
            label={labels.genes}
            value={labels.results[outcome.genes]}
          />
          <VisualFact label={labels.sex} value={labels.results[outcome.sex]} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
