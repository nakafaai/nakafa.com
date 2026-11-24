"use client";

import type { Stage } from "@repo/design-system/components/contents/biology/implantation/cleavage";
import {
  embryoAt,
  MAX_DAY,
} from "@repo/design-system/components/contents/biology/implantation/cleavage";
import type { ImplantationPart } from "@repo/design-system/components/contents/biology/implantation/scene";
import { ImplantationScene } from "@repo/design-system/components/contents/biology/implantation/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface ImplantationLabProps {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly cells?: NonNullable<ReactNode>;
    readonly day: NonNullable<ReactNode>;
    readonly parts: Readonly<Record<ImplantationPart, string>>;
    readonly share?: NonNullable<ReactNode>;
    readonly stage: NonNullable<ReactNode>;
    readonly stages: Readonly<Record<Stage, string>>;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}

/**
 * Interactive first-week embryonic cleavage and implantation lab showing
 * division inside the constant-size zona pellucida from zygote to implanting
 * blastocyst.
 */
export function ImplantationLab({
  description,
  labels,
  title,
}: ImplantationLabProps) {
  const [day, setDay] = useState(0);

  const state = embryoAt(day);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset onReset={() => setDay(0)} />

      <VisualCardToolbar>
        <VisualSlider
          heading={labels.day}
          label={labels.view}
          max={MAX_DAY}
          min={0}
          onValueChange={setDay}
          pauseOnChange
          readout={`${day}`}
          step={1}
          value={day}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.0} setting="studio">
          <Suspense fallback={null}>
            <ImplantationScene day={day} onDay={setDay} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular label={labels.day} value={`${day}`} />
          <VisualFact label={labels.stage} value={labels.stages[state.stage]} />
          {labels.cells !== undefined && (
            <VisualFactTabular label={labels.cells} value={`${state.cells}`} />
          )}
          {labels.share !== undefined && (
            <VisualFactTabular label={labels.share} value={state.share} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
