import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { RubberState } from "@repo/design-system/components/contents/chemistry/rubber/model";
import { RubberVulcanizationScene } from "@repo/design-system/components/contents/chemistry/rubber/scene";
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
  VisualFactIndicator,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function RubberVulcanizationLab({
  description,
  labels,
  states,
  stretch,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly elasticityNote?: ReactNode;
    readonly heatNote?: ReactNode;
    readonly parts: Readonly<
      Record<
        "doubleBond" | "isopreneChain" | "sulfurCrosslink" | "tensionArrow",
        string
      >
    >;
    readonly state: string;
    readonly states: Readonly<
      Partial<
        Record<
          RubberState,
          {
            readonly elasticityNote: ReactNode;
            readonly heatNote: ReactNode;
            readonly name: ReactNode;
          }
        >
      >
    >;
    readonly stretch: string;
    readonly view: string;
  };
  readonly states: readonly [RubberState, ...RubberState[]];
  readonly stretch: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<RubberState>(states[0]);
  const [stretchVal, setStretchVal] = useState(stretch.value);
  const quantity = useQuantity();

  const active = Arr.contains(states, selected) ? selected : states[0];
  const copy = labels.states[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(states[0]);
          setStretchVal(stretch.value);
        }}
      />

      <VisualCardToolbar>
        {states.length > 1 ? (
          <ToggleGroup
            aria-label={labels.state}
            gridColumns={toggleColumns(states.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(states, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(states, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.states[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.stretch}
          label={labels.stretch}
          max={stretch.max}
          min={stretch.min}
          onValueChange={setStretchVal}
          readout={<InlineMath math={quantity(stretchVal, "\\%", 0)} />}
          step={1}
          value={stretchVal}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={1.25} setting="lab">
          <Suspense fallback={null}>
            <RubberVulcanizationScene
              parts={labels.parts}
              state={active}
              stretchPercent={stretchVal}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              active === "vulcanisedRubber"
                ? ORGANIC_COLORS.sulfurBridge
                : ORGANIC_COLORS.isopreneEmerald
            }
            label={labels.state}
            value={copy?.name ?? active}
          />
          {labels.elasticityNote === undefined || copy === undefined ? null : (
            <VisualFact
              label={labels.elasticityNote}
              value={copy.elasticityNote}
            />
          )}
          {labels.heatNote === undefined || copy === undefined ? null : (
            <VisualFact label={labels.heatNote} value={copy.heatNote} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
