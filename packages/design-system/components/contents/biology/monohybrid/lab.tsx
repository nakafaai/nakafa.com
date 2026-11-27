import type { MonohybridCross } from "@repo/design-system/components/contents/biology/monohybrid/model";
import { MonohybridCrossScene } from "@repo/design-system/components/contents/biology/monohybrid/scene";
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
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function MonohybridCrossLab({
  crosses,
  description,
  labels,
  title,
}: {
  readonly crosses: readonly [MonohybridCross, ...MonohybridCross[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly cross: string;
    readonly crosses: Readonly<
      Partial<
        Record<
          MonohybridCross,
          {
            readonly genotypeRatio: ReactNode;
            readonly name: ReactNode;
            readonly phenotypeRatio: ReactNode;
          }
        >
      >
    >;
    readonly genotypeRatio?: ReactNode;
    readonly parts: Readonly<
      Record<"dwarfPea" | "gamete" | "parentA" | "parentB" | "tallPea", string>
    >;
    readonly phenotypeRatio?: ReactNode;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<MonohybridCross>(crosses[0]);
  const active = Arr.contains(crosses, selected) ? selected : crosses[0];
  const copy = labels.crosses[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(crosses[0]);
        }}
      />

      {crosses.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.cross}
            gridColumns={toggleColumns(crosses.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(crosses, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(crosses, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.crosses[id]?.name ?? id}
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
        <ScienceStage floor={0} ground="epoxy" reach={2.6} setting="lab">
          <Suspense fallback={null}>
            <MonohybridCrossScene cross={active} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={GENETICS_COLORS.tallLeaf}
            label={labels.cross}
            value={copy?.name ?? active}
          />
          {labels.genotypeRatio === undefined || copy === undefined ? null : (
            <VisualFact
              label={labels.genotypeRatio}
              value={copy.genotypeRatio}
            />
          )}
          {labels.phenotypeRatio === undefined || copy === undefined ? null : (
            <VisualFact
              label={labels.phenotypeRatio}
              value={copy.phenotypeRatio}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
