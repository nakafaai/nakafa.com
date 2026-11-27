import { slideUp } from "@repo/design-system/components/contents/physics/mechanics/force";
import { InclineScene } from "@repo/design-system/components/contents/physics/mechanics/incline/scene";
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
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import type { ReactNode } from "react";
import { Suspense } from "react";

interface InclineSlideLabProps {
  /** The plane's angle to the horizontal, in degrees. */
  angle: number;
  description: NonNullable<ReactNode>;
  /** The friction on the block, in newtons. */
  friction: number;
  /** The gravitational field strength, in N kg⁻¹. */
  gravity: number;
  labels: {
    along: ReactNode;
    deceleration: ReactNode;
    distance: ReactNode;
    viewLabel: string;
  };
  /** The block's mass, in kilograms. */
  mass: number;
  /** The block's speed up the plane when it is released, in m s⁻¹. */
  speed: number;
  title: NonNullable<ReactNode>;
}

/**
 * A block released while moving up an inclined plane slides up and stops.
 * While it rises, both the part of its weight along the slope and the
 * friction point down the slope, so together they decelerate it.
 */
export function InclineSlideLab({
  angle,
  description,
  friction,
  gravity,
  labels,
  mass,
  speed,
  title,
}: InclineSlideLabProps) {
  const quantity = useQuantity();
  const slide = slideUp({ angle, friction, gravity, mass, speed });

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage
          floor={0}
          frameloop="always"
          ground="epoxy"
          reach={4}
          setting="lab"
        >
          <Suspense fallback={null}>
            <InclineScene
              angle={angle}
              mass={mass}
              slide={{ ...slide, friction }}
              speed={speed}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.along}
            value={<InlineMath math={quantity(slide.along, "\\text{ N}", 1)} />}
          />
          <VisualFactTabular
            label={labels.deceleration}
            value={
              <InlineMath
                math={quantity(slide.deceleration, "\\text{ m s}^{-2}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.distance}
            value={
              <InlineMath math={quantity(slide.distance, "\\text{ m}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
