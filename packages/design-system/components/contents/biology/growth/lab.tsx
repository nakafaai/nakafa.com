import type {
  GrowthPhase,
  PlantLifeCycle,
} from "@repo/design-system/components/contents/biology/growth/model";
import { evaluateGrowthCurve } from "@repo/design-system/components/contents/biology/growth/model";
import { PlantSpecimenScene } from "@repo/design-system/components/contents/biology/growth/scene";
import { PlantGrowthTrace } from "@repo/design-system/components/contents/biology/growth/trace";
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

export function PlantGrowthCurveLab({
  description,
  labels,
  title,
  types,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly dryMass: ReactNode;
    readonly phase?: ReactNode;
    readonly phases: Readonly<
      Record<GrowthPhase, { readonly detail: ReactNode; readonly name: string }>
    >;
    readonly rate: ReactNode;
    readonly time: string;
    readonly type: string;
    readonly types: Readonly<Partial<Record<PlantLifeCycle, string>>>;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
  readonly types: readonly [PlantLifeCycle, ...PlantLifeCycle[]];
}) {
  const [selectedType, setSelectedType] = useState<PlantLifeCycle>(types[0]);
  const [time, setTime] = useState(35);

  const activeType = Arr.contains(types, selectedType)
    ? selectedType
    : types[0];
  const sample = evaluateGrowthCurve(activeType, time);
  const phaseCopy = labels.phases[sample.phase];

  const handleTickTime = useCallback((delta: number) => {
    setTime((prev) => (prev + delta > 100 ? 0 : prev + delta));
  }, []);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelectedType(types[0]);
          setTime(35);
        }}
      />

      <VisualCardToolbar>
        {types.length > 1 ? (
          <ToggleGroup
            aria-label={labels.type}
            gridColumns={toggleColumns(types.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(types, (item) => item === next),
                setSelectedType
              );
            }}
            type="single"
            value={activeType}
            variant="outline"
          >
            {Arr.map(types, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.types[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.time}
          label={labels.time}
          max={100}
          min={0}
          onValueChange={setTime}
          readout={`${Math.round(time)}%`}
          step={1}
          value={time}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.2} setting="lab">
          <Suspense fallback={null}>
            <PlantSpecimenScene
              lifeCycle={activeType}
              onTickTime={handleTickTime}
              time={time}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <PlantGrowthTrace
          dryMassLabel={labels.dryMass}
          lifeCycle={activeType}
          time={time}
          timeLabel={labels.time}
        />
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.dryMass}
            value={`${Math.round(sample.dryMass * 100)}%`}
          />
          <VisualFactTabular
            label={labels.rate}
            value={`${sample.rate >= 0 ? "+" : ""}${(sample.rate * 100).toFixed(1)}`}
          />
          {labels.phase === undefined ? null : (
            <VisualFact
              label={labels.phase}
              value={
                <span>
                  {phaseCopy.name} ({phaseCopy.detail})
                </span>
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
