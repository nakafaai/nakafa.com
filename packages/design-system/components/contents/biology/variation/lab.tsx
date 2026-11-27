import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { VariationKind } from "@repo/design-system/components/contents/biology/variation/model";
import { VariationDistributionScene } from "@repo/design-system/components/contents/biology/variation/scene";
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
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function VariationDistributionLab({
  description,
  genePairs,
  kinds,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly genePairs: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly kinds: readonly [VariationKind, ...VariationKind[]];
  readonly labels: {
    readonly basis?: ReactNode;
    readonly genePairs: string;
    readonly kind: string;
    readonly kinds: Readonly<
      Partial<
        Record<
          VariationKind,
          {
            readonly basis: ReactNode;
            readonly name: ReactNode;
            readonly shape: ReactNode;
          }
        >
      >
    >;
    readonly parts: Readonly<
      Record<"bellCurve" | "discreteBars" | "environment" | "meanLine", string>
    >;
    readonly shape?: ReactNode;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<VariationKind>(kinds[0]);
  const [pairs, setPairs] = useState(genePairs.value);

  const active = Arr.contains(kinds, selected) ? selected : kinds[0];
  const copy = labels.kinds[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(kinds[0]);
          setPairs(genePairs.value);
        }}
      />

      <VisualCardToolbar>
        {kinds.length > 1 ? (
          <ToggleGroup
            aria-label={labels.kind}
            gridColumns={toggleColumns(kinds.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(kinds, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(kinds, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.kinds[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.genePairs}
          label={labels.genePairs}
          max={genePairs.max}
          min={genePairs.min}
          onValueChange={setPairs}
          readout={`${Math.round(pairs)}`}
          step={1}
          value={pairs}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={2.6} setting="lab">
          <Suspense fallback={null}>
            <VariationDistributionScene
              genePairs={pairs}
              kind={active}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              active === "continuous"
                ? GENETICS_COLORS.bellCurveBlue
                : GENETICS_COLORS.discreteViolet
            }
            label={labels.kind}
            value={copy?.name ?? active}
          />
          {labels.basis === undefined || copy === undefined ? null : (
            <VisualFact label={labels.basis} value={copy.basis} />
          )}
          {labels.shape === undefined || copy === undefined ? null : (
            <VisualFact label={labels.shape} value={copy.shape} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
