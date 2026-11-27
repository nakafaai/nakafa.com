import type { FruitType } from "@repo/design-system/components/contents/biology/fruit/model";
import { FruitSeedScene } from "@repo/design-system/components/contents/biology/fruit/scene";
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
import { Array as Arr, Match, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function FruitSeedDispersalLab({
  description,
  fruits,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly fruits: readonly [FruitType, ...FruitType[]];
  readonly labels: {
    readonly fruit: string;
    readonly fruits: Readonly<
      Partial<
        Record<
          FruitType,
          {
            readonly name: ReactNode;
            readonly origin: ReactNode;
            readonly structure: ReactNode;
          }
        >
      >
    >;
    readonly origin?: ReactNode;
    readonly parts: Readonly<
      Record<
        "cotyledon" | "embryo" | "endosperm" | "pericarp" | "testa",
        string
      >
    >;
    readonly structure?: ReactNode;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<FruitType>(fruits[0]);
  const active = Arr.contains(fruits, selected) ? selected : fruits[0];
  const copy = labels.fruits[active];
  const color = Match.value(active).pipe(
    Match.when("simple", () => BOTANY_COLORS.pericarpPeach),
    Match.when("aggregate", () => BOTANY_COLORS.fruitRed),
    Match.when("multiple", () => BOTANY_COLORS.cotyledonGold),
    Match.exhaustive
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(fruits[0]);
        }}
      />

      {fruits.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.fruit}
            gridColumns={toggleColumns(fruits.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(fruits, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(fruits, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.fruits[id]?.name ?? id}
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
            <FruitSeedScene fruit={active} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={color}
            label={labels.fruit}
            value={copy?.name ?? active}
          />
          {labels.origin === undefined || copy === undefined ? null : (
            <VisualFact label={labels.origin} value={copy.origin} />
          )}
          {labels.structure === undefined || copy === undefined ? null : (
            <VisualFact label={labels.structure} value={copy.structure} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
