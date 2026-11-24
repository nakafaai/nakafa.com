import type { DihybridFilter } from "@repo/design-system/components/contents/biology/dihybrid/model";
import { DihybridCrossScene } from "@repo/design-system/components/contents/biology/dihybrid/scene";
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
import { Array as Arr, Match, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function DihybridCrossLab({
  description,
  filters,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly filters: readonly [DihybridFilter, ...DihybridFilter[]];
  readonly labels: {
    readonly count?: ReactNode;
    readonly filter: string;
    readonly filters: Readonly<
      Partial<
        Record<
          DihybridFilter,
          {
            readonly count: ReactNode;
            readonly name: string;
            readonly ratio: ReactNode;
          }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        "roundGreen" | "roundYellow" | "wrinkledGreen" | "wrinkledYellow",
        string
      >
    >;
    readonly ratio?: ReactNode;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<DihybridFilter>(filters[0]);
  const active = Arr.contains(filters, selected) ? selected : filters[0];
  const copy = labels.filters[active];
  const color = Match.value(active).pipe(
    Match.when("all", () => GENETICS_COLORS.gameteCyan),
    Match.when("dominantBoth", () => GENETICS_COLORS.peaYellow),
    Match.when("recombinants", () => GENETICS_COLORS.carrierAmber),
    Match.when("recessiveBoth", () => GENETICS_COLORS.peaGreen),
    Match.exhaustive
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(filters[0]);
        }}
      />

      {filters.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.filter}
            gridColumns={toggleColumns(filters.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(filters, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(filters, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.filters[id]?.name ?? id}
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
            <DihybridCrossScene filter={active} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={color}
            label={labels.filter}
            value={copy?.name ?? active}
          />
          {labels.ratio === undefined || copy === undefined ? null : (
            <VisualFact label={labels.ratio} value={copy.ratio} />
          )}
          {labels.count === undefined || copy === undefined ? null : (
            <VisualFact label={labels.count} value={copy.count} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
