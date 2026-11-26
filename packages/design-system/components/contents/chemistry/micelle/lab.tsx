import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  MicelleStage,
  WaterType,
} from "@repo/design-system/components/contents/chemistry/micelle/model";
import { SoapMicelleScene } from "@repo/design-system/components/contents/chemistry/micelle/scene";
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
  VisualFactIndicator,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function SoapMicelleEmulsionLab({
  description,
  labels,
  stages,
  title,
  waterTypes,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly mechanism?: ReactNode;
    readonly outcome?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "fabric"
        | "greaseDrop"
        | "hydrophilicHead"
        | "hydrophobicTail"
        | "waterFlow",
        string
      >
    >;
    readonly stage: string;
    readonly stages: Readonly<
      Partial<
        Record<
          MicelleStage,
          { readonly mechanism: ReactNode; readonly name: string }
        >
      >
    >;
    readonly view: string;
    readonly waterType: string;
    readonly waterTypes: Readonly<
      Partial<
        Record<
          WaterType,
          { readonly name: string; readonly outcome: ReactNode }
        >
      >
    >;
  };
  readonly stages: readonly [MicelleStage, ...MicelleStage[]];
  readonly title: NonNullable<ReactNode>;
  readonly waterTypes: readonly [WaterType, ...WaterType[]];
}) {
  const [selectedStage, setSelectedStage] = useState<MicelleStage>(stages[0]);
  const [selectedWater, setSelectedWater] = useState<WaterType>(waterTypes[0]);

  const activeStage = Arr.contains(stages, selectedStage)
    ? selectedStage
    : stages[0];
  const activeWater = Arr.contains(waterTypes, selectedWater)
    ? selectedWater
    : waterTypes[0];
  const stageCopy = labels.stages[activeStage];
  const waterCopy = labels.waterTypes[activeWater];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelectedStage(stages[0]);
          setSelectedWater(waterTypes[0]);
        }}
      />

      {stages.length > 1 || waterTypes.length > 1 ? (
        <VisualCardToolbar>
          {stages.length > 1 ? (
            <ToggleGroup
              aria-label={labels.stage}
              gridColumns={toggleColumns(stages.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(stages, (item) => item === next),
                  setSelectedStage
                );
              }}
              type="single"
              value={activeStage}
              variant="outline"
            >
              {Arr.map(stages, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.stages[id]?.name ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          {waterTypes.length > 1 ? (
            <ToggleGroup
              aria-label={labels.waterType}
              gridColumns={toggleColumns(waterTypes.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(waterTypes, (item) => item === next),
                  setSelectedWater
                );
              }}
              type="single"
              value={activeWater}
              variant="outline"
            >
              {Arr.map(waterTypes, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.waterTypes[id]?.name ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.85} setting="lab">
          <Suspense fallback={null}>
            <SoapMicelleScene
              parts={labels.parts}
              stage={activeStage}
              waterType={activeWater}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              activeWater === "soft"
                ? ORGANIC_COLORS.hydrophilicBlue
                : ORGANIC_COLORS.scumGray
            }
            label={labels.waterType}
            value={waterCopy?.name ?? activeWater}
          />
          {labels.mechanism === undefined || stageCopy === undefined ? null : (
            <VisualFact label={labels.mechanism} value={stageCopy.mechanism} />
          )}
          {labels.outcome === undefined || waterCopy === undefined ? null : (
            <VisualFact label={labels.outcome} value={waterCopy.outcome} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
