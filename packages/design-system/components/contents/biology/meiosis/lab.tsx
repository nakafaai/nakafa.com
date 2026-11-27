import type { MeiosisStage } from "@repo/design-system/components/contents/biology/meiosis/model";
import { evaluateMeiosisCombinations } from "@repo/design-system/components/contents/biology/meiosis/model";
import { MeiosisShufflingScene } from "@repo/design-system/components/contents/biology/meiosis/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function MeiosisShufflingLab({
  chromosomePairs,
  description,
  labels,
  stages,
  title,
}: {
  readonly chromosomePairs: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly chromosomePairs: string;
    readonly combinations?: ReactNode;
    readonly mechanism?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "centromere"
        | "chiasma"
        | "gamete"
        | "maternalChromatid"
        | "paternalChromatid",
        string
      >
    >;
    readonly stage: string;
    readonly stages: Readonly<
      Partial<
        Record<
          MeiosisStage,
          { readonly mechanism: ReactNode; readonly name: ReactNode }
        >
      >
    >;
    readonly view: string;
  };
  readonly stages: readonly [MeiosisStage, ...MeiosisStage[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<MeiosisStage>(stages[0]);
  const [pairs, setPairs] = useState(chromosomePairs.value);
  const quantity = useQuantity();

  const active = Arr.contains(stages, selected) ? selected : stages[0];
  const reading = evaluateMeiosisCombinations(active, pairs);
  const copy = labels.stages[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(stages[0]);
          setPairs(chromosomePairs.value);
        }}
      />

      <VisualCardToolbar>
        {stages.length > 1 ? (
          <ToggleGroup
            aria-label={labels.stage}
            gridColumns={toggleColumns(stages.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(stages, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(stages, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.stages[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.chromosomePairs}
          label={labels.chromosomePairs}
          max={chromosomePairs.max}
          min={chromosomePairs.min}
          onValueChange={setPairs}
          readout={<InlineMath math={quantity(pairs, "", 0)} />}
          step={1}
          value={pairs}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <MeiosisShufflingScene
              chromosomePairs={pairs}
              parts={labels.parts}
              stage={active}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.stage} value={copy?.name ?? active} />
          {labels.mechanism === undefined || copy === undefined ? null : (
            <VisualFact label={labels.mechanism} value={copy.mechanism} />
          )}
          {labels.combinations === undefined ? null : (
            <VisualFactTabular
              label={labels.combinations}
              value={<InlineMath math={reading.combinationsMath} />}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
