import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { venturi } from "@repo/design-system/components/contents/physics/fluid/pressure";
import { VenturiScene } from "@repo/design-system/components/contents/physics/fluid/venturi/scene";
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

interface VenturiTubeLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    drop: ReactNode;
    faster: ReactNode;
    speed: ReactNode;
    speedName: string;
    viewLabel: string;
  };
  /** The diameter of the narrow section, in centimetres. */
  narrow: number;
  /** The water speed in the wide section the lab starts at, in m s⁻¹. */
  speed: number;
  title: NonNullable<ReactNode>;
  /** The diameter of the wide section, in centimetres. */
  wide: number;
}

/**
 * Water flows steadily through a horizontal pipe that narrows halfway, with
 * an open tube above each section. The same volume passes every second, so
 * the water runs faster through the narrow part, as the tracer specks show,
 * and there its pressure is lower, so its tube holds a shorter column. Speed
 * the flow up and watch the difference between the columns grow.
 */
export function VenturiTubeLab({
  description,
  labels,
  narrow,
  speed: start,
  title,
  wide,
}: VenturiTubeLabProps) {
  const quantity = useQuantity();
  const [speed, setSpeed] = useState(start);
  const flow = venturi(wide, narrow, speed);
  const most = venturi(wide, narrow, Math.max(1, start * 2)).drop;

  return (
    <VisualCard
      onReset={() => {
        setSpeed(start);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.speed}</span>}
          max={Math.max(1, start * 2)}
          min={0.1}
          name={labels.speedName}
          onValueChange={setSpeed}
          readout={
            <InlineMath math={quantity(speed, "\\text{ m s}^{-1}", 2)} />
          }
          step={0.05}
          value={speed}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={3} setting="lab">
          <Suspense fallback={null}>
            <VenturiScene
              drop={flow.drop}
              faster={flow.faster}
              most={most}
              ratio={narrow / wide}
              speed={speed}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.faster}
            value={
              <InlineMath
                math={quantity(flow.faster, "\\text{ m s}^{-1}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.drop}
            value={
              <InlineMath math={quantity(flow.drop * 100, "\\text{ cm}", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
