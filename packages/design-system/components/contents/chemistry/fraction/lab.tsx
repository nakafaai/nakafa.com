import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { PetroleumFraction } from "@repo/design-system/components/contents/chemistry/fraction/model";
import { FractionalDistillationScene } from "@repo/design-system/components/contents/chemistry/fraction/scene";
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
import { Array as Arr, Match, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function FractionalDistillationLab({
  description,
  fractions,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly fractions: readonly [PetroleumFraction, ...PetroleumFraction[]];
  readonly labels: {
    readonly boilingRange?: ReactNode;
    readonly fraction: string;
    readonly fractions: Readonly<
      Partial<
        Record<
          PetroleumFraction,
          {
            readonly boilingRange: ReactNode;
            readonly name: string;
            readonly useNote: ReactNode;
          }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        "bubbleCap" | "column" | "furnace" | "outletPipe" | "vaporStream",
        string
      >
    >;
    readonly useNote?: ReactNode;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<PetroleumFraction>(fractions[0]);
  const active = Arr.contains(fractions, selected) ? selected : fractions[0];
  const copy = labels.fractions[active];
  const dotColor = Match.value(active).pipe(
    Match.when("refineryGas", () => ORGANIC_COLORS.refineryCyan),
    Match.when("petrol", () => ORGANIC_COLORS.petrolYellow),
    Match.when("kerosene", () => ORGANIC_COLORS.keroseneOrange),
    Match.when("diesel", () => ORGANIC_COLORS.dieselAmber),
    Match.when("bitumen", () => ORGANIC_COLORS.bitumenBlack),
    Match.exhaustive
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(fractions[0]);
        }}
      />

      {fractions.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.fraction}
            gridColumns={toggleColumns(fractions.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(fractions, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(fractions, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.fractions[id]?.name ?? id}
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
            <FractionalDistillationScene
              fraction={active}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={dotColor}
            label={labels.fraction}
            value={copy?.name ?? active}
          />
          {labels.boilingRange === undefined || copy === undefined ? null : (
            <VisualFact label={labels.boilingRange} value={copy.boilingRange} />
          )}
          {labels.useNote === undefined || copy === undefined ? null : (
            <VisualFact label={labels.useNote} value={copy.useNote} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
