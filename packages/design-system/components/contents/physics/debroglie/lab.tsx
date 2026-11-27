import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { QuantumParticle } from "@repo/design-system/components/contents/physics/debroglie/model";
import { evaluateDeBroglie } from "@repo/design-system/components/contents/physics/debroglie/model";
import { DeBroglieScene } from "@repo/design-system/components/contents/physics/debroglie/scene";
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

export function DeBroglieMatterWaveLab({
  description,
  labels,
  particles,
  title,
  voltage,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly diffraction?: ReactNode;
    readonly momentum: ReactNode;
    readonly particle: string;
    readonly particles: Readonly<Partial<Record<QuantumParticle, string>>>;
    readonly parts: Readonly<
      Record<
        | "diffractionRings"
        | "electronGun"
        | "graphiteTarget"
        | "matterWave"
        | "screen",
        string
      >
    >;
    readonly view: string;
    readonly voltage: string;
    readonly wavelength?: ReactNode;
  };
  readonly particles: readonly [QuantumParticle, ...QuantumParticle[]];
  readonly title: NonNullable<ReactNode>;
  readonly voltage: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
}) {
  const [selected, setSelected] = useState<QuantumParticle>(particles[0]);
  const [volts, setVolts] = useState(voltage.value);
  const quantity = useQuantity();

  const active = Arr.contains(particles, selected) ? selected : particles[0];
  const reading = evaluateDeBroglie(active, volts);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(particles[0]);
          setVolts(voltage.value);
        }}
      />

      <VisualCardToolbar>
        {particles.length > 1 ? (
          <ToggleGroup
            aria-label={labels.particle}
            gridColumns={toggleColumns(particles.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(particles, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(particles, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.particles[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.voltage}
          label={labels.voltage}
          max={voltage.max}
          min={voltage.min}
          onValueChange={setVolts}
          readout={<InlineMath math={quantity(volts, "\\text{ V}", 0)} />}
          step={Math.max(10, Math.round((voltage.max - voltage.min) / 80))}
          value={volts}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <DeBroglieScene
              diffractionRadius={reading.diffractionRadius}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.momentum}
            value={
              <InlineMath
                math={quantity(
                  reading.momentumUnits,
                  "\\times 10^{-24}\\text{ kg m s}^{-1}",
                  2
                )}
              />
            }
          />
          {labels.wavelength === undefined ? null : (
            <VisualFactTabular
              label={labels.wavelength}
              value={
                <InlineMath
                  math={quantity(reading.wavelengthPm, "\\text{ pm}", 2)}
                />
              }
            />
          )}
          {labels.diffraction === undefined ? null : (
            <VisualFactTabular
              label={labels.diffraction}
              value={
                <InlineMath
                  math={quantity(reading.diffractionRadius * 100, "\\%", 0)}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
