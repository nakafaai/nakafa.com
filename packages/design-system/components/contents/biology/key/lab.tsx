import type {
  CoupletId,
  KeyAnimal,
} from "@repo/design-system/components/contents/biology/key/model";
import {
  evaluateKey,
  initialSteps,
} from "@repo/design-system/components/contents/biology/key/model";
import { KeyBuilderScene } from "@repo/design-system/components/contents/biology/key/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

export function KeyBuilderLab({
  animals,
  couplets,
  description,
  labels,
  title,
}: {
  readonly animals: readonly [KeyAnimal, ...KeyAnimal[]];
  readonly couplets: readonly [CoupletId, ...CoupletId[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly animals: Readonly<Partial<Record<KeyAnimal, string>>>;
    readonly couplets: Readonly<
      Partial<Record<CoupletId, { readonly a: string; readonly b: string }>>
    >;
    readonly failed: ReactNode;
    readonly reached: ReactNode;
    readonly run: string;
    readonly sorted: ReactNode;
    readonly step: string;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [steps, setSteps] = useState<readonly CoupletId[]>(() =>
    initialSteps(animals, couplets)
  );
  const [runVersion, setRunVersion] = useState(1);

  const evaluation = useMemo(
    () => evaluateKey(animals, steps),
    [animals, steps]
  );

  const coupletOptions = Arr.map(couplets, (entry) => {
    const pair = labels.couplets[entry];
    return {
      label: pair === undefined ? entry : `${pair.a} / ${pair.b}`,
      value: entry,
    };
  });

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSteps(initialSteps(animals, couplets));
          setRunVersion(1);
        }}
      />

      <VisualCardToolbar>
        {Arr.map(steps, (chosen, stepIndex) => {
          const stepTitle = `${labels.step} ${stepIndex + 1}`;
          return (
            <Select
              items={coupletOptions}
              key={stepTitle}
              onValueChange={(next: CoupletId | null) => {
                if (next === null) {
                  return;
                }
                setSteps((current) =>
                  Arr.map(current, (item, idx) =>
                    idx === stepIndex ? next : item
                  )
                );
                setRunVersion((count) => count + 1);
              }}
              value={chosen}
            >
              <SelectTrigger aria-label={stepTitle} className="w-full">
                <SelectValue
                  labels={Arr.map(coupletOptions, (item) => item.label)}
                  placeholder={stepTitle}
                />
              </SelectTrigger>
              <SelectContent label={stepTitle}>
                {Arr.map(coupletOptions, (item) => (
                  <SelectItem key={item.value} plain value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}

        <Button
          onClick={() => setRunVersion((count) => count + 1)}
          variant="outline"
        >
          {labels.run}
        </Button>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <KeyBuilderScene
              animalNames={labels.animals}
              evaluation={evaluation}
              runVersion={runVersion}
              stepCount={steps.length}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.reached}
            value={`${evaluation.reachedCount} / ${animals.length}`}
          />
          {evaluation.allSorted ? (
            <VisualFactIndicator
              indicatorColor={CLASSIFICATION_COLORS.branchActive}
              label={labels.run}
              value={labels.sorted}
            />
          ) : (
            <VisualFactIndicator
              indicatorColor={CLASSIFICATION_COLORS.branchBlocked}
              label={labels.failed}
              value={Option.match(evaluation.failedStep, {
                onNone: () => `${labels.step} 1`,
                onSome: (step) => `${labels.step} ${step}`,
              })}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
