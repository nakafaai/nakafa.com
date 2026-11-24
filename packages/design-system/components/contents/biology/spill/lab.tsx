"use client";

import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  Incident,
  ResponseStepsMap,
} from "@repo/design-system/components/contents/biology/spill/protocol";
import {
  stageCopy,
  stagesOf,
} from "@repo/design-system/components/contents/biology/spill/protocol";
import { SpillScene } from "@repo/design-system/components/contents/biology/spill/scene";
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
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface SpillResponseLabProps {
  readonly description: NonNullable<ReactNode>;
  readonly incidents: readonly [Incident, ...Incident[]];
  readonly labels: {
    readonly incident: string;
    readonly incidents: Readonly<Partial<Record<Incident, string>>>;
    readonly step: NonNullable<ReactNode>;
    readonly steps: ResponseStepsMap<NonNullable<ReactNode>>;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}

/**
 * Interactive stage-by-stage emergency response workbench for school biology
 * laboratory accidents (chemical eye splash, mercury spill, microbial
 * culture spill, broken glass, and solvent fire).
 */
export function SpillResponseLab({
  description,
  incidents,
  labels,
  title,
}: SpillResponseLabProps) {
  const [incident, setIncident] = useState<Incident>(incidents[0]);
  const [stage, setStage] = useState(0);

  const stages = stagesOf(incident);
  const currentStep = stageCopy(incident, stage, labels.steps);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setIncident(incidents[0]);
          setStage(0);
        }}
      />

      <VisualCardToolbar>
        {incidents.length > 1 && (
          <ToggleGroup
            aria-label={labels.incident}
            onValueChange={(next) => {
              if (
                next === "eye" ||
                next === "mercury" ||
                next === "culture" ||
                next === "glass" ||
                next === "fire"
              ) {
                setIncident(next);
                setStage(0);
              }
            }}
            size="sm"
            type="single"
            value={incident}
          >
            {Arr.map(incidents, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.incidents[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        <VisualSlider
          heading={labels.incidents[incident] ?? labels.incident}
          label={labels.incidents[incident] ?? labels.incident}
          max={stages.length}
          min={1}
          onValueChange={(value) => setStage(value - 1)}
          pauseOnChange
          readout={`${stage + 1} / ${stages.length}`}
          step={1}
          value={stage + 1}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={1.3} setting="lab">
          <Suspense fallback={null}>
            <SpillScene incident={incident} onStage={setStage} stage={stage} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.step}
            value={`${stage + 1} / ${stages.length}`}
          />
          {Option.match(currentStep, {
            onNone: () => null,
            onSome: (copy) => (
              <VisualFact
                label={labels.incidents[incident] ?? incident}
                value={copy}
              />
            ),
          })}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
