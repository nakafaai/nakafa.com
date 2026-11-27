import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { BlocksScene } from "@repo/design-system/components/contents/physics/mechanics/blocks/scene";
import { connectedBlocks } from "@repo/design-system/components/contents/physics/mechanics/force";
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

interface ConnectedBlocksLabProps {
  /** The mass of the back block, in kilograms. */
  back: number;
  description: NonNullable<ReactNode>;
  /** The friction on the back block, in newtons. */
  friction: number;
  /** The mass of the front block, in kilograms. */
  front: number;
  labels: {
    acceleration: ReactNode;
    pull: ReactNode;
    pullName: string;
    tension: ReactNode;
    viewLabel: string;
  };
  /** The pull on the front block, in newtons. */
  pull: number;
  title: NonNullable<ReactNode>;
}

/**
 * Two blocks joined by a light string are pulled across the bench from the
 * front by a newton meter. Taken together, the string's tension is internal, so the pull less
 * the friction accelerates both; taken alone, the back block is pulled only
 * by the string, which must overcome its friction and accelerate it. Change
 * the pull and watch the tension follow.
 */
export function ConnectedBlocksLab({
  back,
  description,
  friction,
  front,
  labels,
  pull: start,
  title,
}: ConnectedBlocksLabProps) {
  const quantity = useQuantity();
  const [pull, setPull] = useState(start);
  const blocks = connectedBlocks({ back, friction, front, pull });
  const most = Math.max(40, start * 2);

  return (
    <VisualCard
      onReset={() => {
        setPull(start);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.pull}</span>}
          max={most}
          min={Math.ceil(friction)}
          name={labels.pullName}
          onValueChange={setPull}
          readout={<InlineMath math={quantity(pull, "\\text{ N}", 0)} />}
          step={1}
          value={pull}
        />
      </VisualCardToolbar>
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
            <BlocksScene
              blocks={blocks}
              friction={friction}
              masses={{ back, front }}
              most={most}
              pull={pull}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.acceleration}
            value={
              <InlineMath
                math={quantity(blocks.acceleration, "\\text{ m s}^{-2}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.tension}
            value={
              <InlineMath math={quantity(blocks.tension, "\\text{ N}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
