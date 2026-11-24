import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { OrbitingBody } from "@repo/design-system/components/contents/physics/kepler/model";
import { evaluateKepler } from "@repo/design-system/components/contents/physics/kepler/model";
import { KeplerOrbitScene } from "@repo/design-system/components/contents/physics/kepler/scene";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function KeplerOrbitPeriodLab({
  bodies,
  description,
  eccentricity,
  labels,
  title,
}: {
  readonly bodies: readonly [OrbitingBody, ...OrbitingBody[]];
  readonly description: NonNullable<ReactNode>;
  readonly eccentricity: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly labels: {
    readonly bodies: Readonly<Partial<Record<OrbitingBody, string>>>;
    readonly body: string;
    readonly eccentricity: string;
    readonly parts: Readonly<
      Record<
        "aphelion" | "areaSector" | "focus" | "perihelion" | "planet" | "sun",
        string
      >
    >;
    readonly period?: ReactNode;
    readonly radius: ReactNode;
    readonly ratio: ReactNode;
    readonly speed?: ReactNode;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<OrbitingBody>(bodies[0]);
  const [ecc, setEcc] = useState(eccentricity.value);
  const quantity = useQuantity();

  const active = Arr.contains(bodies, selected) ? selected : bodies[0];
  const reading = evaluateKepler(active, ecc);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(bodies[0]);
          setEcc(eccentricity.value);
        }}
      />

      <VisualCardToolbar>
        {bodies.length > 1 ? (
          <ToggleGroup
            aria-label={labels.body}
            gridColumns={toggleColumns(bodies.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(bodies, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(bodies, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.bodies[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.eccentricity}
          label={labels.eccentricity}
          max={eccentricity.max}
          min={eccentricity.min}
          onValueChange={setEcc}
          readout={<InlineMath math={quantity(ecc, "", 2)} />}
          step={0.05}
          value={ecc}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.6} setting="lab">
          <Suspense fallback={null}>
            <KeplerOrbitScene
              body={active}
              eccentricity={ecc}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.radius}
            value={
              <InlineMath
                math={quantity(reading.semiMajorAu, "\\text{ AU}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.ratio}
            value={<InlineMath math={quantity(reading.keplerRatio, "", 2)} />}
          />
          {labels.period === undefined ? null : (
            <VisualFactTabular
              label={labels.period}
              value={
                <InlineMath
                  math={quantity(reading.periodYears, "\\text{ yr}", 2)}
                />
              }
            />
          )}
          {labels.speed === undefined ? null : (
            <VisualFactTabular
              label={labels.speed}
              value={`${reading.speedRatio.toFixed(2)}x`}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
