import { fallTime } from "@repo/design-system/components/contents/physics/field/magnet";
import {
  DRAG,
  GRAVITY,
  PIPE,
} from "@repo/design-system/components/contents/physics/field/pipe/drag";
import { MagnetPipeScene } from "@repo/design-system/components/contents/physics/field/pipe/scene";
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

interface MagnetPipeLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    copper: ReactNode;
    plastic: ReactNode;
    slit: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

/**
 * The same strong magnet dropped at the same moment through three pipes of
 * the same size: plastic, copper, and copper with a slit along its length.
 * In the copper pipe the falling magnet drives eddy currents round the pipe,
 * whose field opposes its motion, so it drifts down slowly; the slit cuts
 * those loops and the plastic carries none, so there it falls faster or
 * freely. The facts give each fall time through one metre.
 */
export function MagnetPipeLab({
  description,
  labels,
  title,
}: MagnetPipeLabProps) {
  const quantity = useQuantity();
  const times = {
    copper: fallTime(DRAG.copper, GRAVITY, PIPE),
    plastic: fallTime(DRAG.plastic, GRAVITY, PIPE),
    slit: fallTime(DRAG.slit, GRAVITY, PIPE),
  };

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={3} setting="lab">
          <Suspense fallback={null}>
            <MagnetPipeScene longest={times.copper} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={<>1. {labels.plastic}</>}
            value={
              <InlineMath math={quantity(times.plastic, "\\text{ s}", 2)} />
            }
          />
          <VisualFactTabular
            label={<>2. {labels.copper}</>}
            value={
              <InlineMath math={quantity(times.copper, "\\text{ s}", 1)} />
            }
          />
          <VisualFactTabular
            label={<>3. {labels.slit}</>}
            value={<InlineMath math={quantity(times.slit, "\\text{ s}", 2)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
