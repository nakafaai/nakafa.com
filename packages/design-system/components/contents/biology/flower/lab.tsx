import type { PollinationMode } from "@repo/design-system/components/contents/biology/flower/model";
import { FlowerAnatomyScene } from "@repo/design-system/components/contents/biology/flower/scene";
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

export function FlowerAnatomyLab({
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
          PollinationMode,
          {
            readonly adaptation: ReactNode;
            readonly name: ReactNode;
            readonly pollen: ReactNode;
          }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        | "anther"
        | "filament"
        | "ovary"
        | "ovule"
        | "petal"
        | "sepal"
        | "stigma"
        | "style",
        string
      >
    >;
    readonly pollen?: ReactNode;
    readonly view: string;
  };
  readonly modes: readonly [PollinationMode, ...PollinationMode[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<PollinationMode>(modes[0]);
  const active = Arr.contains(modes, selected) ? selected : modes[0];
  const copy = labels.modes[active];

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
        <ScienceStage floor={0} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <FlowerAnatomyScene mode={active} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              active === "insect"
                ? BOTANY_COLORS.flowerPink
                : BOTANY_COLORS.windGreen
            }
            label={labels.mode}
            value={copy?.name ?? active}
          />
          {labels.pollen === undefined || copy === undefined ? null : (
            <VisualFact label={labels.pollen} value={copy.pollen} />
          )}
          {labels.adaptation === undefined || copy === undefined ? null : (
            <VisualFact label={labels.adaptation} value={copy.adaptation} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
