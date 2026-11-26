import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { PeriodOxide } from "@repo/design-system/components/contents/chemistry/oxide/model";
import { PeriodThreeOxideScene } from "@repo/design-system/components/contents/chemistry/oxide/scene";
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

export function PeriodThreeOxideLab({
  description,
  labels,
  oxides,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly acidBaseNature?: ReactNode;
    readonly bonding?: ReactNode;
    readonly oxide: string;
    readonly oxides: Readonly<
      Partial<
        Record<
          PeriodOxide,
          {
            readonly acidBaseNature: ReactNode;
            readonly bonding: ReactNode;
            readonly name: string;
          }
        >
      >
    >;
    readonly parts: Readonly<
      Record<"latticeModel" | "oxideSample" | "phMeter" | "waterBeaker", string>
    >;
    readonly view: string;
  };
  readonly oxides: readonly [PeriodOxide, ...PeriodOxide[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<PeriodOxide>(oxides[0]);
  const active = Arr.contains(oxides, selected) ? selected : oxides[0];
  const copy = labels.oxides[active];
  const dotColor = Match.value(active).pipe(
    Match.when("na2o", () => PROCESS_COLORS.alkaliBlue),
    Match.when("mgo", () => PROCESS_COLORS.weakBaseTeal),
    Match.when("al2o3", () => PROCESS_COLORS.neutralGreen),
    Match.when("sio2", () => PROCESS_COLORS.silicaBlue),
    Match.when("p4o10", () => PROCESS_COLORS.acidRed),
    Match.when("so2", () => PROCESS_COLORS.acidRed),
    Match.exhaustive
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(oxides[0]);
        }}
      />

      {oxides.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.oxide}
            gridColumns={toggleColumns(oxides.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(oxides, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(oxides, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.oxides[id]?.name ?? id}
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
        <ScienceStage floor={0} reach={1.25} setting="lab">
          <Suspense fallback={null}>
            <PeriodThreeOxideScene oxide={active} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={dotColor}
            label={labels.oxide}
            value={copy?.name ?? active}
          />
          {labels.acidBaseNature === undefined || copy === undefined ? null : (
            <VisualFact
              label={labels.acidBaseNature}
              value={copy.acidBaseNature}
            />
          )}
          {labels.bonding === undefined || copy === undefined ? null : (
            <VisualFact label={labels.bonding} value={copy.bonding} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
