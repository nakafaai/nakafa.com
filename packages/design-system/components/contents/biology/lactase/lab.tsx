import type { LactaseMethod } from "@repo/design-system/components/contents/biology/lactase/model";
import { evaluateColumn } from "@repo/design-system/components/contents/biology/lactase/model";
import { LactaseScene } from "@repo/design-system/components/contents/biology/lactase/scene";
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
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { ENZYME_COLORS } from "@repo/design-system/lib/material/enzyme";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function LactaseColumnLab({
  description,
  flow: flowRange,
  labels,
  methods,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly flow: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly labels: {
    readonly batches: ReactNode;
    readonly enzyme: ReactNode;
    readonly flow: string;
    readonly glucose: ReactNode;
    readonly lactose: ReactNode;
    readonly method: string;
    readonly methods: Readonly<Partial<Record<LactaseMethod, string>>>;
    readonly negative: ReactNode;
    readonly none: ReactNode;
    readonly parts: Readonly<
      Record<"column" | "beads" | "milk" | "strip", string>
    >;
    readonly positive: ReactNode;
    readonly present: ReactNode;
    readonly view: string;
  };
  readonly methods: readonly [LactaseMethod, ...LactaseMethod[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [method, setMethod] = useState<LactaseMethod>(methods[0]);
  const [flowRate, setFlowRate] = useState(flowRange.value);
  const quantity = useQuantity();
  const outcome = evaluateColumn(method, flowRate);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setMethod(methods[0]);
          setFlowRate(flowRange.value);
        }}
      />

      <VisualCardToolbar>
        {methods.length > 1 ? (
          <ToggleGroup
            aria-label={labels.method}
            gridColumns={toggleColumns(methods.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(methods, (entry) => entry === next),
                setMethod
              );
            }}
            type="single"
            value={method}
            variant="outline"
          >
            {Arr.map(methods, (entry) => (
              <ToggleGroupItem key={entry} value={entry}>
                {labels.methods[entry] ?? entry}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.flow}
          label={labels.flow}
          max={flowRange.max}
          min={flowRange.min}
          onValueChange={setFlowRate}
          readout={
            <InlineMath math={quantity(flowRate, "\\text{ mL min}^{-1}", 1)} />
          }
          step={0.5}
          value={flowRate}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.2} setting="lab">
          <Suspense fallback={null}>
            <LactaseScene
              flowRate={flowRate}
              glucosePositive={outcome.glucosePositive}
              method={method}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.lactose}
            value={
              <InlineMath math={quantity(outcome.lactoseRemaining, "\\%", 0)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={
              outcome.glucosePositive
                ? ENZYME_COLORS.stripPositive
                : ENZYME_COLORS.stripNegative
            }
            label={labels.glucose}
            value={outcome.glucosePositive ? labels.positive : labels.negative}
          />
          <VisualFactIndicator
            indicatorColor={
              outcome.enzymeInMilk ? ENZYME_COLORS.fitNo : ENZYME_COLORS.fitYes
            }
            label={labels.enzyme}
            value={outcome.enzymeInMilk ? labels.present : labels.none}
          />
          <VisualFactTabular label={labels.batches} value={outcome.batches} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
