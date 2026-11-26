import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { ContactStage } from "@repo/design-system/components/contents/chemistry/contact/model";
import { ContactSulfuricScene } from "@repo/design-system/components/contents/chemistry/contact/scene";
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
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr, Match, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function ContactSulfuricTowerLab({
  description,
  labels,
  stages,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly conditions?: ReactNode;
    readonly equation?: ReactNode;
    readonly parts: Readonly<
      Record<
        "absorptionTower" | "acidPipe" | "burner" | "oleumTank" | "vanadiumBed",
        string
      >
    >;
    readonly stage: string;
    readonly stages: Readonly<
      Partial<
        Record<
          ContactStage,
          {
            readonly conditions: ReactNode;
            readonly equation: ReactNode;
            readonly name: string;
          }
        >
      >
    >;
    readonly view: string;
  };
  readonly stages: readonly [ContactStage, ...ContactStage[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<ContactStage>(stages[0]);
  const active = Arr.contains(stages, selected) ? selected : stages[0];
  const copy = labels.stages[active];
  const dotColor = Match.value(active).pipe(
    Match.when("roasting", () => PROCESS_COLORS.sulfurYellow),
    Match.when("catalyticOxidation", () => PROCESS_COLORS.vanadiumOrange),
    Match.when("oleumAbsorption", () => PROCESS_COLORS.oleumAmber),
    Match.when("dilution", () => PROCESS_COLORS.catalystTeal),
    Match.exhaustive
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(stages[0]);
        }}
      />

      {stages.length > 1 ? (
        <VisualCardToolbar>
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
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.7} setting="lab">
          <Suspense fallback={null}>
            <ContactSulfuricScene parts={labels.parts} stage={active} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={dotColor}
            label={labels.stage}
            value={copy?.name ?? active}
          />
          {labels.conditions === undefined || copy === undefined ? null : (
            <VisualFact label={labels.conditions} value={copy.conditions} />
          )}
          {labels.equation === undefined || copy === undefined ? null : (
            <VisualFact label={labels.equation} value={copy.equation} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
