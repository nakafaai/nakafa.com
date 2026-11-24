import type { ReflexType } from "@repo/design-system/components/contents/biology/reflex/model";
import { evaluateReflex } from "@repo/design-system/components/contents/biology/reflex/model";
import { ReflexArcScene } from "@repo/design-system/components/contents/biology/reflex/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
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
import { Suspense, useCallback, useState } from "react";

export function ReflexArcLab({
  description,
  labels,
  reflexes,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly parts: Readonly<
      Record<
        | "dorsalRoot"
        | "effector"
        | "greyMatter"
        | "motorNeuron"
        | "receptor"
        | "relayNeuron"
        | "sensoryNeuron"
        | "ventralRoot"
        | "whiteMatter",
        string
      >
    >;
    readonly pathway?: ReactNode;
    readonly reflex: string;
    readonly reflexes: Readonly<
      Partial<
        Record<
          ReflexType,
          {
            readonly name: string;
            readonly response: ReactNode;
            readonly stimulus: ReactNode;
          }
        >
      >
    >;
    readonly step: string;
    readonly synapses?: ReactNode;
    readonly view: string;
  };
  readonly reflexes: readonly [ReflexType, ...ReflexType[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<ReflexType>(reflexes[0]);
  const [step, setStep] = useState(25);

  const active = Arr.contains(reflexes, selected) ? selected : reflexes[0];
  const profile = evaluateReflex(active, step);
  const copy = labels.reflexes[active];

  const handleStep = useCallback((delta: number) => {
    setStep((prev) => (prev + delta > 100 ? 0 : prev + delta));
  }, []);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(reflexes[0]);
          setStep(25);
        }}
      />

      <VisualCardToolbar>
        {reflexes.length > 1 ? (
          <ToggleGroup
            aria-label={labels.reflex}
            gridColumns={toggleColumns(reflexes.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(reflexes, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(reflexes, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.reflexes[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.step}
          label={labels.step}
          max={100}
          min={0}
          onValueChange={setStep}
          readout={`${Math.round(step)}%`}
          step={1}
          value={step}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <ReflexArcScene
              onStep={handleStep}
              parts={labels.parts}
              reflex={active}
              step={step}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {copy === undefined ? null : (
            <VisualFact label={labels.reflex} value={copy.stimulus} />
          )}
          {copy === undefined ? null : (
            <VisualFact label={labels.parts.effector} value={copy.response} />
          )}
          {labels.pathway === undefined ? null : (
            <VisualFact
              label={labels.pathway}
              value={
                profile.hasRelay
                  ? `${labels.parts.sensoryNeuron} -> ${labels.parts.relayNeuron} -> ${labels.parts.motorNeuron}`
                  : `${labels.parts.sensoryNeuron} -> ${labels.parts.motorNeuron}`
              }
            />
          )}
          {labels.synapses === undefined ? null : (
            <VisualFactTabular
              label={labels.synapses}
              value={`${profile.synapseCount}`}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
