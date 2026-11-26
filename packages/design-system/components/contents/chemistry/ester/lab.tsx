import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { EsterId } from "@repo/design-system/components/contents/chemistry/ester/model";
import { EsterificationRefluxScene } from "@repo/design-system/components/contents/chemistry/ester/scene";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function EsterificationRefluxLab({
  description,
  esters,
  labels,
  temperature,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly esters: readonly [EsterId, ...EsterId[]];
  readonly labels: {
    readonly aroma?: ReactNode;
    readonly equation?: ReactNode;
    readonly ester: string;
    readonly esters: Readonly<
      Partial<
        Record<
          EsterId,
          {
            readonly aroma: ReactNode;
            readonly equation: ReactNode;
            readonly name: string;
          }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        | "catalystDrop"
        | "condenser"
        | "esterLayer"
        | "roundFlask"
        | "waterBath",
        string
      >
    >;
    readonly temperature: string;
    readonly view: string;
  };
  readonly temperature: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<EsterId>(esters[0]);
  const [tempVal, setTempVal] = useState(temperature.value);
  const quantity = useQuantity();

  const active = Arr.contains(esters, selected) ? selected : esters[0];
  const copy = labels.esters[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(esters[0]);
          setTempVal(temperature.value);
        }}
      />

      <VisualCardToolbar>
        {esters.length > 1 ? (
          <ToggleGroup
            aria-label={labels.ester}
            gridColumns={toggleColumns(esters.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(esters, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(esters, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.esters[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.temperature}
          label={labels.temperature}
          max={temperature.max}
          min={temperature.min}
          onValueChange={setTempVal}
          readout={
            <InlineMath math={quantity(tempVal, "^\\circ\\text{C}", 0)} />
          }
          step={1}
          value={tempVal}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <EsterificationRefluxScene
              ester={active}
              parts={labels.parts}
              temperatureC={tempVal}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={ORGANIC_COLORS.esterRose}
            label={labels.ester}
            value={copy?.name ?? active}
          />
          {labels.aroma === undefined || copy === undefined ? null : (
            <VisualFact label={labels.aroma} value={copy.aroma} />
          )}
          {labels.equation === undefined || copy === undefined ? null : (
            <VisualFact label={labels.equation} value={copy.equation} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
