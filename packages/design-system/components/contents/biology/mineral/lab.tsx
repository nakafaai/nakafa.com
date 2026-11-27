import type { CultureSolution } from "@repo/design-system/components/contents/biology/mineral/model";
import { MineralDeficiencyScene } from "@repo/design-system/components/contents/biology/mineral/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function MineralDeficiencyLab({
  description,
  labels,
  solutions,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly parts: Readonly<
      Record<"airTube" | "leaf" | "root" | "solution" | "stem", string>
    >;
    readonly role?: ReactNode;
    readonly solution: string;
    readonly solutions: Readonly<
      Partial<
        Record<
          CultureSolution,
          {
            readonly name: ReactNode;
            readonly role: ReactNode;
            readonly symptom: ReactNode;
          }
        >
      >
    >;
    readonly symptom?: ReactNode;
    readonly view: string;
  };
  readonly solutions: readonly [CultureSolution, ...CultureSolution[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<CultureSolution>(solutions[0]);
  const active = Arr.contains(solutions, selected) ? selected : solutions[0];
  const copy = labels.solutions[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(solutions[0]);
        }}
      />

      {solutions.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.solution}
            gridColumns={toggleColumns(solutions.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(solutions, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(solutions, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.solutions[id]?.name ?? id}
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
        <ScienceStage floor={0} ground="epoxy" reach={2.4} setting="lab">
          <Suspense fallback={null}>
            <MineralDeficiencyScene parts={labels.parts} solution={active} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              active === "complete"
                ? BOTANY_COLORS.healthyLeaf
                : BOTANY_COLORS.chlorosisYellow
            }
            label={labels.solution}
            value={copy?.name ?? active}
          />
          {labels.role === undefined || copy === undefined ? null : (
            <VisualFact label={labels.role} value={copy.role} />
          )}
          {labels.symptom === undefined || copy === undefined ? null : (
            <VisualFact label={labels.symptom} value={copy.symptom} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
