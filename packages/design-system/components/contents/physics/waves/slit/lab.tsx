import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { SlitScene } from "@repo/design-system/components/contents/physics/waves/slit/scene";
import { spacingOf } from "@repo/design-system/components/contents/physics/waves/slit/screen";
import { fringesInSpan } from "@repo/design-system/components/contents/physics/waves/wave";
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

interface DoubleSlitLabProps {
  description: NonNullable<ReactNode>;
  /** The distance from the slits to the screen the lab starts at, in metres. */
  distance: number;
  labels: {
    count: ReactNode;
    distance: ReactNode;
    distanceName: string;
    separation: ReactNode;
    separationName: string;
    spacing: ReactNode;
    viewLabel: string;
  };
  /** The slit separation the lab starts at, in millimetres. */
  separation: number;
  /** A distance along the screen, in millimetres, from one bright fringe to another, whose fringes the lab counts. */
  span?: number;
  title: NonNullable<ReactNode>;
  /** The wavelength of the light, in nanometres. */
  wavelength: number;
}

/**
 * Young's double slit on an optics bench: a laser lights two narrow slits,
 * and the light from them overlaps on a screen in bright and dark fringes
 * x = λD/a apart. Move the screen or change the slits and watch the fringes
 * spread or close up; with a span marked, count the bright fringes in it,
 * both ends included.
 */
export function DoubleSlitLab({
  description,
  distance: startDistance,
  labels,
  separation: startSeparation,
  span,
  title,
  wavelength,
}: DoubleSlitLabProps) {
  const quantity = useQuantity();
  const [distance, setDistance] = useState(startDistance);
  const [separation, setSeparation] = useState(startSeparation);
  const spacing = spacingOf({ distance, separation, wavelength });

  return (
    <VisualCard
      onReset={() => {
        setDistance(startDistance);
        setSeparation(startSeparation);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-4">
          <LabSlider
            label={<span>{labels.separation}</span>}
            max={0.6}
            min={0.1}
            name={labels.separationName}
            onValueChange={setSeparation}
            readout={
              <InlineMath math={quantity(separation, "\\text{ mm}", 2)} />
            }
            step={0.05}
            value={separation}
          />
          <LabSlider
            label={<span>{labels.distance}</span>}
            max={3}
            min={0.5}
            name={labels.distanceName}
            onValueChange={setDistance}
            readout={<InlineMath math={quantity(distance, "\\text{ m}", 1)} />}
            step={0.1}
            value={distance}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={4} setting="lab">
          <Suspense fallback={null}>
            <SlitScene
              distance={distance}
              separation={separation}
              spacing={spacing}
              span={span}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.spacing}
            value={
              <InlineMath math={`x=${quantity(spacing, "\\text{ mm}", 2)}`} />
            }
          />
          {span === undefined ? null : (
            <VisualFactTabular
              label={labels.count}
              value={<InlineMath math={`${fringesInSpan(span, spacing)}`} />}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
