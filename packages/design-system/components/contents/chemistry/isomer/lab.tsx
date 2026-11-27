import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { IsomerCompound } from "@repo/design-system/components/contents/chemistry/isomer/model";
import { AlkaneAlkeneScene } from "@repo/design-system/components/contents/chemistry/isomer/scene";
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

export function AlkaneAlkeneIsomerLab({
  compounds,
  description,
  labels,
  title,
}: {
  readonly compounds: readonly [IsomerCompound, ...IsomerCompound[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly bromineTest?: ReactNode;
    readonly compound: string;
    readonly compounds: Readonly<
      Partial<
        Record<
          IsomerCompound,
          {
            readonly bromineTest: ReactNode;
            readonly formula: ReactNode;
            readonly name: ReactNode;
          }
        >
      >
    >;
    readonly formula?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "bromineDrop"
        | "carbonAtom"
        | "doubleBond"
        | "hydrogenAtom"
        | "singleBond",
        string
      >
    >;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<IsomerCompound>(compounds[0]);
  const active = Arr.contains(compounds, selected) ? selected : compounds[0];
  const copy = labels.compounds[active];
  const isAlkene = active === "but1ene" || active === "but2ene";

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(compounds[0]);
        }}
      />

      {compounds.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.compound}
            gridColumns={toggleColumns(compounds.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(compounds, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(compounds, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.compounds[id]?.name ?? id}
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
        <ScienceStage floor={0} reach={0.85} setting="lab">
          <Suspense fallback={null}>
            <AlkaneAlkeneScene compound={active} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              isAlkene
                ? ORGANIC_COLORS.doubleBondGold
                : ORGANIC_COLORS.carbonDark
            }
            label={labels.compound}
            value={copy?.name ?? active}
          />
          {labels.formula === undefined || copy === undefined ? null : (
            <VisualFact label={labels.formula} value={copy.formula} />
          )}
          {labels.bromineTest === undefined || copy === undefined ? null : (
            <VisualFact label={labels.bromineTest} value={copy.bromineTest} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
