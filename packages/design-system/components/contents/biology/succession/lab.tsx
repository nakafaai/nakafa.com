import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  SuccessionPathway,
  SuccessionStage,
} from "@repo/design-system/components/contents/biology/succession/model";
import { evaluateSuccessionStage } from "@repo/design-system/components/contents/biology/succession/model";
import { EcologicalSuccessionScene } from "@repo/design-system/components/contents/biology/succession/scene";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
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
import {
  VisualFact,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function EcologicalSuccessionLab({
  description,
  labels,
  pathways,
  stages,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly biodiversity?: ReactNode;
    readonly parts: Readonly<
      Record<
        "bedrock" | "canopyTree" | "pioneerPlant" | "shrubLayer" | "topsoil",
        string
      >
    >;
    readonly pathway: string;
    readonly pathways: Readonly<Partial<Record<SuccessionPathway, string>>>;
    readonly soilDepth?: ReactNode;
    readonly stage: string;
    readonly stages: Readonly<
      Partial<
        Record<
          SuccessionStage,
          { readonly name: ReactNode; readonly summary: ReactNode }
        >
      >
    >;
    readonly view: string;
  };
  readonly pathways: readonly [SuccessionPathway, ...SuccessionPathway[]];
  readonly stages: readonly [SuccessionStage, ...SuccessionStage[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const initialStage = Option.getOrElse(
    Arr.findFirst(stages, (item) => item === "youngWoodland"),
    () => stages[0]
  );
  const [selectedPathway, setSelectedPathway] = useState<SuccessionPathway>(
    pathways[0]
  );
  const [selectedStage, setSelectedStage] =
    useState<SuccessionStage>(initialStage);
  const quantity = useQuantity();

  const activePathway = Arr.contains(pathways, selectedPathway)
    ? selectedPathway
    : pathways[0];
  const activeStage = Arr.contains(stages, selectedStage)
    ? selectedStage
    : initialStage;
  const reading = evaluateSuccessionStage(activePathway, activeStage);
  const copy = labels.stages[activeStage];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelectedPathway(pathways[0]);
          setSelectedStage(initialStage);
        }}
      />

      <VisualCardToolbar>
        {pathways.length > 1 ? (
          <ToggleGroup
            aria-label={labels.pathway}
            gridColumns={toggleColumns(pathways.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(pathways, (item) => item === next),
                setSelectedPathway
              );
            }}
            type="single"
            value={activePathway}
            variant="outline"
          >
            {Arr.map(pathways, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.pathways[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

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
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="soil" reach={2.8} setting="field">
          <Suspense fallback={null}>
            <EcologicalSuccessionScene
              parts={labels.parts}
              pathway={activePathway}
              stage={activeStage}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {copy === undefined ? null : (
            <VisualFact label={labels.stage} value={copy.summary} />
          )}
          {labels.soilDepth === undefined ? null : (
            <VisualFactTabular
              label={labels.soilDepth}
              value={
                <InlineMath
                  math={quantity(reading.soilDepthCm, "\\text{ cm}", 0)}
                />
              }
            />
          )}
          {labels.biodiversity === undefined ? null : (
            <VisualFactTabular
              label={labels.biodiversity}
              value={
                <InlineMath
                  math={quantity(reading.biodiversityIndex * 100, "\\%", 0)}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
