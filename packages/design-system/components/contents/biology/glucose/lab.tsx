import type {
  GlucoseState,
  HormoneId,
} from "@repo/design-system/components/contents/biology/glucose/model";
import { evaluateGlucoseFeedback } from "@repo/design-system/components/contents/biology/glucose/model";
import { GlucoseFeedbackScene } from "@repo/design-system/components/contents/biology/glucose/scene";
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
  VisualFactIndicator,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { Array as Arr, Match, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function BloodGlucoseFeedbackLab({
  description,
  glucose,
  labels,
  states,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly glucose: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly labels: {
    readonly actions: Readonly<Partial<Record<GlucoseState, ReactNode>>>;
    readonly glucose: string;
    readonly hormone?: ReactNode;
    readonly hormones: Readonly<Record<HormoneId, string>>;
    readonly liverAction?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "alphaCell"
        | "betaCell"
        | "bloodVessel"
        | "glycogen"
        | "liver"
        | "pancreas",
        string
      >
    >;
    readonly state: string;
    readonly states: Readonly<Partial<Record<GlucoseState, string>>>;
    readonly view: string;
  };
  readonly states: readonly [GlucoseState, ...GlucoseState[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<GlucoseState>(states[0]);
  const [level, setLevel] = useState(glucose.value);
  const quantity = useQuantity();

  const active = Arr.contains(states, selected) ? selected : states[0];
  const reading = evaluateGlucoseFeedback(active, level);
  const actionCopy = labels.actions[active];
  const indicatorColor = Match.value(reading.hormone).pipe(
    Match.when("insulin", () => HOMEOSTASIS_COLORS.betaCell),
    Match.when("glucagon", () => HOMEOSTASIS_COLORS.alphaCell),
    Match.when("balanced", () => HOMEOSTASIS_COLORS.receptor),
    Match.when("deficient", () => HOMEOSTASIS_COLORS.arteriole),
    Match.exhaustive
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(states[0]);
          setLevel(glucose.value);
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
                {labels.states[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.glucose}
          label={labels.glucose}
          max={glucose.max}
          min={glucose.min}
          onValueChange={setLevel}
          readout={
            <InlineMath math={quantity(level, "\\text{ mg dL}^{-1}", 0)} />
          }
          step={5}
          value={level}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <GlucoseFeedbackScene
              glucoseLevel={level}
              parts={labels.parts}
              state={active}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.state}
            value={labels.states[active] ?? active}
          />
          {labels.hormone === undefined ? null : (
            <VisualFactIndicator
              indicatorColor={indicatorColor}
              label={labels.hormone}
              value={labels.hormones[reading.hormone]}
            />
          )}
          {labels.liverAction === undefined ||
          actionCopy === undefined ? null : (
            <VisualFact label={labels.liverAction} value={actionCopy} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
