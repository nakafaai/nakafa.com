import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { photoelectric } from "@repo/design-system/components/contents/physics/nuclear/decay";
import { PhotoelectricScene } from "@repo/design-system/components/contents/physics/nuclear/photo/scene";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface PhotoelectricLabProps {
  /** The elementary charge, in coulombs, which turns joules into electronvolts. */
  charge: number;
  description: NonNullable<ReactNode>;
  labels: {
    energy: ReactNode;
    intensity: ReactNode;
    intensityName: string;
    kinetic: ReactNode;
    none: ReactNode;
    viewLabel: string;
    wavelength: ReactNode;
    wavelengthName: string;
  };
  /** The speed of light, in m s⁻¹. */
  lightSpeed: number;
  /** Planck's constant, in J s. */
  planck: number;
  title: NonNullable<ReactNode>;
  /** The wavelength of the light the lab starts with, in nanometres. */
  wavelength: number;
  /** The work function of the metal, in electronvolts. */
  workFunction: number;
}

/**
 * Light falls on a metal plate in an evacuated tube. Each photon gives its
 * energy, h c / λ, to one electron: below the work function nothing leaves
 * however bright the light, and above it electrons leave with the energy to
 * spare. Change the colour and the brightness and see which one decides
 * whether electrons come out.
 */
export function PhotoelectricLab({
  charge,
  description,
  labels,
  lightSpeed,
  planck,
  title,
  wavelength: start,
  workFunction,
}: PhotoelectricLabProps) {
  const quantity = useQuantity();
  const [wavelength, setWavelength] = useState(start);
  const [intensity, setIntensity] = useState(0.5);
  const photon = photoelectric(wavelength, workFunction, {
    charge,
    light: lightSpeed,
    planck,
  });

  return (
    <VisualCard
      onReset={() => {
        setWavelength(start);
        setIntensity(0.5);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-4">
          <LabSlider
            label={<span>{labels.wavelength}</span>}
            max={700}
            min={300}
            name={labels.wavelengthName}
            onValueChange={setWavelength}
            readout={
              <InlineMath math={quantity(wavelength, "\\text{ nm}", 0)} />
            }
            step={10}
            value={wavelength}
          />
          <LabSlider
            label={<span>{labels.intensity}</span>}
            max={100}
            min={10}
            name={labels.intensityName}
            onValueChange={(value) => setIntensity(value / 100)}
            readout={<InlineMath math={quantity(intensity * 100, "\\%", 0)} />}
            step={10}
            value={Math.round(intensity * 100)}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={3} setting="lab">
          <Suspense fallback={null}>
            <PhotoelectricScene
              emits={photon.emits}
              energy={photon.energy}
              intensity={intensity}
              kinetic={photon.kinetic}
              wavelength={wavelength}
              work={workFunction}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.energy}
            value={
              <InlineMath math={quantity(photon.energy, "\\text{ eV}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.kinetic}
            value={
              photon.emits ? (
                <InlineMath math={quantity(photon.kinetic, "\\text{ eV}", 2)} />
              ) : (
                labels.none
              )
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
