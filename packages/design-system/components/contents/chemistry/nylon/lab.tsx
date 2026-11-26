import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { CondensationPolymer } from "@repo/design-system/components/contents/chemistry/nylon/model";
import { CondensationNylonScene } from "@repo/design-system/components/contents/chemistry/nylon/scene";
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

export function CondensationNylonLab({
  description,
  labels,
  polymers,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly byproduct?: ReactNode;
    readonly linkage?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "esterOrAmideLink"
        | "monomerA"
        | "monomerB"
        | "polymerChain"
        | "waterByproduct",
        string
      >
    >;
    readonly polymer: string;
    readonly polymers: Readonly<
      Partial<
        Record<
          CondensationPolymer,
          {
            readonly byproduct: ReactNode;
            readonly linkage: ReactNode;
            readonly name: string;
          }
        >
      >
    >;
    readonly view: string;
  };
  readonly polymers: readonly [CondensationPolymer, ...CondensationPolymer[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<CondensationPolymer>(polymers[0]);
  const active = Arr.contains(polymers, selected) ? selected : polymers[0];
  const copy = labels.polymers[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(polymers[0]);
        }}
      />

      {polymers.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.polymer}
            gridColumns={toggleColumns(polymers.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(polymers, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(polymers, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.polymers[id]?.name ?? id}
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
            <CondensationNylonScene parts={labels.parts} polymer={active} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              active === "nylon66"
                ? ORGANIC_COLORS.amideBlue
                : ORGANIC_COLORS.esterRose
            }
            label={labels.polymer}
            value={copy?.name ?? active}
          />
          {labels.linkage === undefined || copy === undefined ? null : (
            <VisualFact label={labels.linkage} value={copy.linkage} />
          )}
          {labels.byproduct === undefined || copy === undefined ? null : (
            <VisualFact label={labels.byproduct} value={copy.byproduct} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
