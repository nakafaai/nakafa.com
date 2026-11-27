import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { telescope } from "@repo/design-system/components/contents/physics/optics/ray";
import { TelescopeScene } from "@repo/design-system/components/contents/physics/optics/telescope/scene";
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

interface TelescopeLabProps {
  description: NonNullable<ReactNode>;
  /** The power of the eyepiece the lab starts with, in dioptres. */
  eyepiecePower: number;
  labels: {
    eyepiece: ReactNode;
    eyepieceName: string;
    length: ReactNode;
    magnification: ReactNode;
    objective: ReactNode;
    viewLabel: string;
  };
  /** The power of the objective lens, in dioptres. */
  objectivePower: number;
  title: NonNullable<ReactNode>;
}

/**
 * An astronomical telescope in normal adjustment, built from two lenses on
 * a real optical bench. Light from a distant star enters the
 * objective as a parallel beam, meets at the focal point both lenses share,
 * and leaves the eyepiece parallel again at a steeper angle: the angle grows
 * by the ratio of the focal lengths. Change the eyepiece and watch the tube's
 * length and the magnification change together.
 */
export function TelescopeLab({
  description,
  eyepiecePower: start,
  labels,
  objectivePower,
  title,
}: TelescopeLabProps) {
  const quantity = useQuantity();
  const [eyepiece, setEyepiece] = useState(start);
  const scope = telescope(objectivePower, eyepiece);
  const least = Math.max(2, Math.ceil(objectivePower * 2));

  return (
    <VisualCard
      onReset={() => {
        setEyepiece(start);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.eyepiece}</span>}
          max={Math.max(40, Math.ceil(start * 2))}
          min={least}
          name={labels.eyepieceName}
          onValueChange={setEyepiece}
          readout={<InlineMath math={quantity(eyepiece, "\\text{ D}", 0)} />}
          step={1}
          value={eyepiece}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={4} setting="lab">
          <Suspense fallback={null}>
            <TelescopeScene
              eyepiece={eyepiece}
              labels={labels}
              longest={telescope(objectivePower, least).length}
              objective={objectivePower}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.objective}
            value={
              <InlineMath
                math={`f_o=${quantity(scope.objective, "\\text{ cm}", 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.eyepiece}
            value={
              <InlineMath
                math={`f_e=${quantity(scope.eyepiece, "\\text{ cm}", 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.length}
            value={
              <InlineMath math={quantity(scope.length, "\\text{ cm}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.magnification}
            value={
              <InlineMath math={quantity(scope.magnification, "\\times", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
