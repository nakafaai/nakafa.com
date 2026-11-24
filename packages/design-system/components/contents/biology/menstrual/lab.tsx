"use client";

import type {
  Hormone,
  Outcome,
  Phase,
} from "@repo/design-system/components/contents/biology/menstrual/hormones";
import {
  ovulationDay,
  snapshotAt,
} from "@repo/design-system/components/contents/biology/menstrual/hormones";
import { MenstrualScene } from "@repo/design-system/components/contents/biology/menstrual/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface MenstrualCycleLabProps {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly day: NonNullable<ReactNode>;
    readonly hormones: Readonly<Record<Hormone, string>>;
    readonly length: string;
    readonly outcome: string;
    readonly outcomes: Readonly<Partial<Record<Outcome, string>>>;
    readonly ovulation?: NonNullable<ReactNode>;
    readonly parts: Readonly<
      Record<
        | "ovary"
        | "follicle"
        | "oocyte"
        | "corpusLuteum"
        | "endometrium"
        | "artery",
        string
      >
    >;
    readonly phase: NonNullable<ReactNode>;
    readonly phases: Readonly<Record<Phase, string>>;
    readonly view: string;
  };
  readonly length: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly luteal: number;
  readonly outcomes: readonly [Outcome, ...Outcome[]];
  readonly title: NonNullable<ReactNode>;
}

/**
 * Interactive menstrual cycle lab syncing hormone curves, ovarian follicle and
 * corpus luteum transitions, and endometrial thickness across cycle lengths
 * and outcomes (cycle, pregnancy, miscarriage).
 */
export function MenstrualCycleLab({
  description,
  labels,
  length,
  luteal,
  outcomes,
  title,
}: MenstrualCycleLabProps) {
  const [cycleLength, setCycleLength] = useState(length.value);
  const [outcome, setOutcome] = useState<Outcome>(outcomes[0]);
  const [day, setDay] = useState(1);

  const safeDay = Math.min(day, cycleLength);
  const ovDay = ovulationDay(cycleLength, luteal);
  const snap = snapshotAt(safeDay, cycleLength, luteal, outcome);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setCycleLength(length.value);
          setOutcome(outcomes[0]);
          setDay(1);
        }}
      />

      <VisualCardToolbar>
        {outcomes.length > 1 && (
          <ToggleGroup
            aria-label={labels.outcome}
            onValueChange={(next) => {
              if (
                next === "cycle" ||
                next === "pregnancy" ||
                next === "miscarriage"
              ) {
                setOutcome(next);
              }
            }}
            size="sm"
            type="single"
            value={outcome}
          >
            {Arr.map(outcomes, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.outcomes[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        <VisualSlider
          heading={labels.length}
          label={labels.length}
          max={length.max}
          min={length.min}
          onValueChange={(next) => {
            setCycleLength(next);
            setDay((current) => Math.min(current, next));
          }}
          readout={`${cycleLength}`}
          step={1}
          value={cycleLength}
        />

        <VisualSlider
          heading={labels.day}
          label={labels.length}
          max={cycleLength}
          min={1}
          onValueChange={setDay}
          pauseOnChange
          readout={`${safeDay} / ${cycleLength}`}
          step={1}
          value={safeDay}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.1} setting="studio">
          <Suspense fallback={null}>
            <MenstrualScene
              cycleLength={cycleLength}
              day={safeDay}
              hormones={labels.hormones}
              luteal={luteal}
              onDay={setDay}
              outcome={outcome}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular label={labels.day} value={`${safeDay}`} />
          <VisualFact label={labels.phase} value={labels.phases[snap.phase]} />
          {labels.ovulation !== undefined && (
            <VisualFactTabular label={labels.ovulation} value={`${ovDay}`} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
