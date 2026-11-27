import type { SpecialNutritionMode } from "@repo/design-system/components/contents/biology/carnivore/model";
import { CarnivorousPlantScene } from "@repo/design-system/components/contents/biology/carnivore/scene";
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
import { Array as Arr, Match, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function CarnivorousPlantLab({
  description,
  labels,
  modes,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly adaptation?: ReactNode;
    readonly mode: string;
    readonly modes: Readonly<
      Partial<
        Record<
          SpecialNutritionMode,
          {
            readonly adaptation: ReactNode;
            readonly name: string;
            readonly source: ReactNode;
          }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        "aerialRoot" | "haustorium" | "hostStem" | "insect" | "trapLeaf",
        string
      >
    >;
    readonly source?: ReactNode;
    readonly view: string;
  };
  readonly modes: readonly [SpecialNutritionMode, ...SpecialNutritionMode[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<SpecialNutritionMode>(modes[0]);
  const active = Arr.contains(modes, selected) ? selected : modes[0];
  const copy = labels.modes[active];
  const color = Match.value(active).pipe(
    Match.when("carnivorous", () => BOTANY_COLORS.carnivorePitcher),
    Match.when("parasitic", () => BOTANY_COLORS.dodderOrange),
    Match.when("epiphytic", () => BOTANY_COLORS.healthyLeaf),
    Match.exhaustive
  );

  return (
    <VisualCard
      onReset={() => {
        setSelected(modes[0]);
      }}
    >
      <VisualCardHeader description={description} title={title} />

      {modes.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.mode}
            gridColumns={toggleColumns(modes.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(modes, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(modes, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.modes[id]?.name ?? id}
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
        <ScienceStage floor={0} reach={2.4} setting="lab">
          <Suspense fallback={null}>
            <CarnivorousPlantScene mode={active} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={color}
            label={labels.mode}
            value={copy?.name ?? active}
          />
          {labels.source === undefined || copy === undefined ? null : (
            <VisualFact label={labels.source} value={copy.source} />
          )}
          {labels.adaptation === undefined || copy === undefined ? null : (
            <VisualFact label={labels.adaptation} value={copy.adaptation} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
