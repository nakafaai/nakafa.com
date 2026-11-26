import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { SaponificationStep } from "@repo/design-system/components/contents/chemistry/kettle/model";
import { SaponificationKettleScene } from "@repo/design-system/components/contents/chemistry/kettle/scene";
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

export function SaponificationKettleLab({
  description,
  labels,
  steps,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly chemicalChange?: ReactNode;
    readonly parts: Readonly<
      Record<
        "alkaliStream" | "kettle" | "saltLayer" | "soapCurd" | "triglyceride",
        string
      >
    >;
    readonly purpose?: ReactNode;
    readonly step: string;
    readonly steps: Readonly<
      Partial<
        Record<
          SaponificationStep,
          {
            readonly chemicalChange: ReactNode;
            readonly name: string;
            readonly purpose: ReactNode;
          }
        >
      >
    >;
    readonly view: string;
  };
  readonly steps: readonly [SaponificationStep, ...SaponificationStep[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<SaponificationStep>(steps[0]);
  const active = Arr.contains(steps, selected) ? selected : steps[0];
  const copy = labels.steps[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(steps[0]);
        }}
      />

      {steps.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.step}
            gridColumns={toggleColumns(steps.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(steps, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(steps, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.steps[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <SaponificationKettleScene parts={labels.parts} step={active} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={ORGANIC_COLORS.triglycerideGold}
            label={labels.step}
            value={copy?.name ?? active}
          />
          {labels.chemicalChange === undefined || copy === undefined ? null : (
            <VisualFact
              label={labels.chemicalChange}
              value={copy.chemicalChange}
            />
          )}
          {labels.purpose === undefined || copy === undefined ? null : (
            <VisualFact label={labels.purpose} value={copy.purpose} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
