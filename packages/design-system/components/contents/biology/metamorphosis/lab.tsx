"use client";

import type {
  Insect,
  Stage,
} from "@repo/design-system/components/contents/biology/metamorphosis/growth";
import { growthAt } from "@repo/design-system/components/contents/biology/metamorphosis/growth";
import type { MetamorphosisPart } from "@repo/design-system/components/contents/biology/metamorphosis/scene";
import { MetamorphosisScene } from "@repo/design-system/components/contents/biology/metamorphosis/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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

interface MetamorphosisLabProps {
  readonly description: NonNullable<ReactNode>;
  readonly insects: readonly [Insect, ...Insect[]];
  readonly labels: {
    readonly insect: string;
    readonly insects: Readonly<Partial<Record<Insect, string>>>;
    readonly instar: NonNullable<ReactNode>;
    readonly length: NonNullable<ReactNode>;
    readonly mass: NonNullable<ReactNode>;
    readonly moults: NonNullable<ReactNode>;
    readonly parts: Readonly<Record<MetamorphosisPart, string>>;
    readonly stage: NonNullable<ReactNode>;
    readonly stages: Readonly<Record<Stage, string>>;
    readonly time: string;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}

/**
 * Interactive insect metamorphosis workbench comparing incomplete
 * metamorphosis (grasshopper) and complete metamorphosis (butterfly) with
 * stepped exoskeleton length growth, ecdysis moults, and continuous mass gain.
 */
export function MetamorphosisLab({
  description,
  insects,
  labels,
  title,
}: MetamorphosisLabProps) {
  const [insect, setInsect] = useState<Insect>(insects[0]);
  const [time, setTime] = useState(0);

  const snap = growthAt(insect, time);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setInsect(insects[0]);
          setTime(0);
        }}
      />

      <VisualCardToolbar>
        {insects.length > 1 && (
          <ToggleGroup
            aria-label={labels.insect}
            onValueChange={(next) => {
              if (next === "grasshopper" || next === "butterfly") {
                setInsect(next);
                setTime(0);
              }
            }}
            size="sm"
            type="single"
            value={insect}
          >
            {Arr.map(insects, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.insects[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        <VisualSlider
          heading={labels.time}
          label={labels.time}
          max={100}
          min={0}
          onValueChange={(pct) => setTime(pct / 100)}
          pauseOnChange
          readout={`${Math.round(time * 100)}%`}
          step={1}
          value={Math.round(time * 100)}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.0} setting="studio">
          <Suspense fallback={null}>
            <MetamorphosisScene
              insect={insect}
              onTime={setTime}
              parts={labels.parts}
              time={time}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.stage} value={labels.stages[snap.stage]} />
          <VisualFactTabular label={labels.instar} value={`${snap.instar}`} />
          <VisualFactTabular label={labels.moults} value={`${snap.moults}`} />
          <VisualFactTabular
            label={labels.length}
            value={`${snap.lengthMm} mm`}
          />
          <VisualFactTabular label={labels.mass} value={`${snap.massMg} mg`} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
