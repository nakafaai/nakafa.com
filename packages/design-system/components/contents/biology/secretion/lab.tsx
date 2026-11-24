import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  SecretionRoute,
  SecretionStep,
} from "@repo/design-system/components/contents/biology/secretion/model";
import { stepsForRoute } from "@repo/design-system/components/contents/biology/secretion/model";
import { SecretionScene } from "@repo/design-system/components/contents/biology/secretion/scene";
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
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useCallback, useState } from "react";

export function EnzymeSecretionLab({
  description,
  labels,
  routes,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly example: ReactNode;
    readonly examples: Readonly<Partial<Record<SecretionRoute, ReactNode>>>;
    readonly parts: Readonly<
      Record<
        | "nucleus"
        | "ribosome"
        | "reticulum"
        | "golgi"
        | "vesicle"
        | "membrane"
        | "duct",
        string
      >
    >;
    readonly place: ReactNode;
    readonly places: Readonly<Partial<Record<SecretionRoute, ReactNode>>>;
    readonly route: string;
    readonly routes: Readonly<Partial<Record<SecretionRoute, string>>>;
    readonly step: ReactNode;
    readonly steps: Readonly<Partial<Record<SecretionStep, ReactNode>>>;
    readonly view: string;
  };
  readonly routes: readonly [SecretionRoute, ...SecretionRoute[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [route, setRoute] = useState<SecretionRoute>(routes[0]);
  const [stepIndex, setStepIndex] = useState(0);
  const steps = stepsForRoute(route);
  const clampedIndex = Math.min(stepIndex, steps.length - 1);
  const activeStep = steps[clampedIndex] ?? steps[0];

  const handleAdvanceStep = useCallback(() => {
    setStepIndex((current) => (current + 1) % steps.length);
  }, [steps.length]);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setRoute(routes[0]);
          setStepIndex(0);
        }}
      />

      <VisualCardToolbar>
        {routes.length > 1 ? (
          <ToggleGroup
            aria-label={labels.route}
            gridColumns={toggleColumns(routes.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(routes, (entry) => entry === next),
                (picked) => {
                  setRoute(picked);
                  setStepIndex(0);
                }
              );
            }}
            type="single"
            value={route}
            variant="outline"
          >
            {Arr.map(routes, (entry) => (
              <ToggleGroupItem key={entry} value={entry}>
                {labels.routes[entry] ?? entry}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.step}
          label={labels.route}
          max={steps.length - 1}
          min={0}
          onValueChange={setStepIndex}
          pauseOnChange
          readout={`${clampedIndex + 1} / ${steps.length}`}
          step={1}
          value={clampedIndex}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.5} setting="studio">
          <Suspense fallback={null}>
            <SecretionScene
              activeStep={activeStep}
              onAdvanceStep={handleAdvanceStep}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.step}
            value={labels.steps[activeStep] ?? activeStep}
          />
          <VisualFact
            label={labels.example}
            value={labels.examples[route] ?? route}
          />
          <VisualFact
            label={labels.place}
            value={labels.places[route] ?? route}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
