"use client";

import type {
  CellKey,
  Level,
  Sex,
} from "@repo/design-system/components/contents/biology/gametogenesis/division";
import { divisionState } from "@repo/design-system/components/contents/biology/gametogenesis/division";
import type { AnatomyPart } from "@repo/design-system/components/contents/biology/gametogenesis/organs";
import { GametogenesisScene } from "@repo/design-system/components/contents/biology/gametogenesis/scene";
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

interface GametogenesisLabProps {
  readonly chromosomes: number;
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly cell: NonNullable<ReactNode>;
    readonly cells: Readonly<Record<CellKey, string>>;
    readonly chromosomes?: NonNullable<ReactNode>;
    readonly level: string;
    readonly levels: Readonly<Partial<Record<Level, string>>>;
    readonly made?: NonNullable<ReactNode>;
    readonly parts: Readonly<Record<AnatomyPart, string>>;
    readonly polar: NonNullable<ReactNode>;
    readonly sex: string;
    readonly sexes: Readonly<Partial<Record<Sex, string>>>;
    readonly view: string;
  };
  readonly levels: readonly [Level, ...Level[]];
  readonly sexes: readonly [Sex, ...Sex[]];
  readonly title: NonNullable<ReactNode>;
}

/**
 * Interactive gametogenesis lab contrasting spermatogenesis and oogenesis
 * across reproductive tract, gonad tissue, meiosis, and mature gamete scales.
 */
export function GametogenesisLab({
  chromosomes,
  description,
  labels,
  levels,
  sexes,
  title,
}: GametogenesisLabProps) {
  const [sex, setSex] = useState<Sex>(sexes[0]);
  const [level, setLevel] = useState<Level>(levels[0]);
  const [step, setStep] = useState(0);

  const state = divisionState(sex, level, step, chromosomes);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSex(sexes[0]);
          setLevel(levels[0]);
          setStep(0);
        }}
      />

      <VisualCardToolbar>
        {sexes.length > 1 && (
          <ToggleGroup
            aria-label={labels.sex}
            onValueChange={(next) => {
              if (next === "male" || next === "female") {
                setSex(next);
                setStep(0);
              }
            }}
            size="sm"
            type="single"
            value={sex}
          >
            {Arr.map(sexes, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.sexes[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {levels.length > 1 && (
          <ToggleGroup
            aria-label={labels.level}
            onValueChange={(next) => {
              if (
                next === "system" ||
                next === "gonad" ||
                next === "meiosis" ||
                next === "gamete"
              ) {
                setLevel(next);
                setStep(0);
              }
            }}
            size="sm"
            type="single"
            value={level}
          >
            {Arr.map(levels, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.levels[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {level === "meiosis" && (
          <VisualSlider
            heading={labels.levels.meiosis ?? labels.level}
            label={labels.levels.meiosis ?? labels.level}
            max={4}
            min={1}
            onValueChange={(value) => setStep(value - 1)}
            pauseOnChange
            readout={`${step + 1} / 4`}
            step={1}
            value={step + 1}
          />
        )}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={1.9} setting="studio">
          <Suspense fallback={null}>
            <GametogenesisScene
              cells={labels.cells}
              level={level}
              onStep={setStep}
              parts={labels.parts}
              sex={sex}
              step={step}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.cell} value={labels.cells[state.cellKey]} />
          {labels.chromosomes !== undefined && (
            <VisualFactTabular
              label={labels.chromosomes}
              value={`${state.chromosomeCount}`}
            />
          )}
          {labels.made !== undefined && (
            <VisualFactTabular
              label={labels.made}
              value={`${state.madeCount}`}
            />
          )}
          <VisualFactTabular
            label={labels.polar}
            value={`${state.polarCount}`}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
