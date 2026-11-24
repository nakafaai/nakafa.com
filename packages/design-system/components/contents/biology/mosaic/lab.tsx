import type { MembraneComponent } from "@repo/design-system/components/contents/biology/mosaic/model";
import { evaluateMembraneFluidity } from "@repo/design-system/components/contents/biology/mosaic/model";
import { FluidMosaicScene } from "@repo/design-system/components/contents/biology/mosaic/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function FluidMosaicMembraneLab({
  components,
  description,
  labels,
  temperature,
  title,
}: {
  readonly components: readonly [MembraneComponent, ...MembraneComponent[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly component: string;
    readonly components: Readonly<
      Partial<
        Record<
          MembraneComponent,
          { readonly name: string; readonly role: ReactNode }
        >
      >
    >;
    readonly fluidity?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "cholesterol"
        | "glycolipid"
        | "glycoprotein"
        | "hydrophilicHead"
        | "hydrophobicTail"
        | "integralProtein",
        string
      >
    >;
    readonly role?: ReactNode;
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
  const [selected, setSelected] = useState<MembraneComponent>(components[0]);
  const [temp, setTemp] = useState(temperature.value);
  const quantity = useQuantity();

  const active = Arr.contains(components, selected) ? selected : components[0];
  const reading = evaluateMembraneFluidity(temp);
  const copy = labels.components[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(components[0]);
          setTemp(temperature.value);
        }}
      />

      <VisualCardToolbar>
        {components.length > 1 ? (
          <ToggleGroup
            aria-label={labels.component}
            gridColumns={toggleColumns(components.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(components, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(components, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.components[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.temperature}
          label={labels.temperature}
          max={temperature.max}
          min={temperature.min}
          onValueChange={setTemp}
          readout={<InlineMath math={quantity(temp, "^\\circ\\text{C}", 0)} />}
          step={1}
          value={temp}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <FluidMosaicScene
              component={active}
              parts={labels.parts}
              temperatureC={temp}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.component} value={copy?.name ?? active} />
          {labels.role === undefined || copy === undefined ? null : (
            <VisualFact label={labels.role} value={copy.role} />
          )}
          {labels.fluidity === undefined ? null : (
            <VisualFactTabular
              label={labels.fluidity}
              value={`${reading.fluidityPercent}%`}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
