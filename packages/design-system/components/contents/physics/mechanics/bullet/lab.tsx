import { BulletScene } from "@repo/design-system/components/contents/physics/mechanics/bullet/scene";
import { embedAndSlide } from "@repo/design-system/components/contents/physics/mechanics/force";
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

interface BulletBlockLabProps {
  /** The mass of the wooden block, in kilograms. */
  blockMass: number;
  /** The mass of the bullet, in grams. */
  bulletMass: number;
  description: NonNullable<ReactNode>;
  /** The friction between the block and the floor, in newtons. */
  friction: number;
  labels: {
    deceleration: ReactNode;
    distance: ReactNode;
    lost: ReactNode;
    velocity: ReactNode;
    viewLabel: string;
  };
  /** The bullet's speed, in m s⁻¹. */
  speed: number;
  title: NonNullable<ReactNode>;
}

/**
 * A bullet embeds in a wooden block resting on the bench, and the block
 * slides to a stop. The collision keeps momentum but not kinetic energy,
 * which is why the block starts slowly; then friction slows the bullet and
 * block together at a steady rate until they stop.
 */
export function BulletBlockLab({
  blockMass,
  bulletMass,
  description,
  friction,
  labels,
  speed,
  title,
}: BulletBlockLabProps) {
  const quantity = useQuantity();
  const motion = embedAndSlide({
    block: blockMass,
    bullet: bulletMass / 1000,
    friction,
    speed,
  });

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
            <BulletScene
              distance={motion.distance}
              mass={blockMass}
              time={motion.time}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.velocity}
            value={
              <InlineMath
                math={quantity(motion.velocity, "\\text{ m s}^{-1}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.deceleration}
            value={
              <InlineMath
                math={quantity(motion.deceleration, "\\text{ m s}^{-2}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.distance}
            value={
              <InlineMath math={quantity(motion.distance, "\\text{ m}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.lost}
            value={
              <InlineMath math={quantity(motion.lostEnergy, "\\text{ J}", 0)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
