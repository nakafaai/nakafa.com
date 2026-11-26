import type {
  QuadratOrganism,
  SamplingMethod,
} from "@repo/design-system/components/contents/biology/quadrat/model";
import { evaluateQuadratSampling } from "@repo/design-system/components/contents/biology/quadrat/model";
import { QuadratSamplingScene } from "@repo/design-system/components/contents/biology/quadrat/scene";
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

export function QuadratSamplingLab({
  description,
  labels,
  methods,
  organisms,
  quadrats,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly coverage?: ReactNode;
    readonly density?: ReactNode;
    readonly method: string;
    readonly methods: Readonly<Partial<Record<SamplingMethod, string>>>;
    readonly organism: string;
    readonly organisms: Readonly<
      Partial<
        Record<
          QuadratOrganism,
          { readonly habit: ReactNode; readonly name: string }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        "canopy" | "gridPlot" | "markerFlag" | "quadratFrame" | "transectLine",
        string
      >
    >;
    readonly quadrats: string;
    readonly view: string;
  };
  readonly methods: readonly [SamplingMethod, ...SamplingMethod[]];
  readonly organisms: readonly [QuadratOrganism, ...QuadratOrganism[]];
  readonly quadrats: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selectedOrg, setSelectedOrg] = useState<QuadratOrganism>(organisms[0]);
  const [selectedMethod, setSelectedMethod] = useState<SamplingMethod>(
    methods[0]
  );
  const [count, setCount] = useState(quadrats.value);
  const quantity = useQuantity();

  const activeOrg = Arr.contains(organisms, selectedOrg)
    ? selectedOrg
    : organisms[0];
  const activeMethod = Arr.contains(methods, selectedMethod)
    ? selectedMethod
    : methods[0];
  const reading = evaluateQuadratSampling(activeOrg, activeMethod, count);
  const orgCopy = labels.organisms[activeOrg];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelectedOrg(organisms[0]);
          setSelectedMethod(methods[0]);
          setCount(quadrats.value);
        }}
      />

      <VisualCardToolbar>
        {organisms.length > 1 ? (
          <ToggleGroup
            aria-label={labels.organism}
            gridColumns={toggleColumns(organisms.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(organisms, (item) => item === next),
                setSelectedOrg
              );
            }}
            type="single"
            value={activeOrg}
            variant="outline"
          >
            {Arr.map(organisms, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.organisms[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {methods.length > 1 ? (
          <ToggleGroup
            aria-label={labels.method}
            gridColumns={toggleColumns(methods.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(methods, (item) => item === next),
                setSelectedMethod
              );
            }}
            type="single"
            value={activeMethod}
            variant="outline"
          >
            {Arr.map(methods, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.methods[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.quadrats}
          label={labels.quadrats}
          max={quadrats.max}
          min={quadrats.min}
          onValueChange={setCount}
          readout={<InlineMath math={`${Math.round(count)}`} />}
          step={1}
          value={count}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="grass" reach={2.8} setting="field">
          <Suspense fallback={null}>
            <QuadratSamplingScene
              method={activeMethod}
              organism={activeOrg}
              parts={labels.parts}
              quadratCount={count}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {orgCopy === undefined ? null : (
            <VisualFact label={labels.organism} value={orgCopy.habit} />
          )}
          {labels.density === undefined ? null : (
            <VisualFactTabular
              label={labels.density}
              value={
                <InlineMath
                  math={quantity(reading.densityPerSqM, "\\text{ m}^{-2}", 1)}
                />
              }
            />
          )}
          {labels.coverage === undefined ? null : (
            <VisualFactTabular
              label={labels.coverage}
              value={`${reading.coveragePercent}%`}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
