import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { springChain } from "@repo/design-system/components/contents/physics/mechanics/force";
import { SpringScene } from "@repo/design-system/components/contents/physics/mechanics/springs/scene";
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

interface SpringChainLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    load: ReactNode;
    loadName: string;
    pair: ReactNode;
    top: ReactNode;
    total: ReactNode;
    viewLabel: string;
  };
  /** The load the springs carry at the start, in newtons. */
  load: number;
  /** The spring constant of each identical spring, in N m⁻¹. */
  stiffness: number;
  title: NonNullable<ReactNode>;
}

/**
 * Spring P hangs from a retort stand and carries springs Q and R side by side,
 * which carry the load. P feels the whole load, while Q and R share it, so
 * each of them stretches half as far. The load drops by the sum of P's
 * stretch and the pair's, which the rule reads off.
 */
export function SpringChainLab({
  description,
  labels,
  load: start,
  stiffness,
  title,
}: SpringChainLabProps) {
  const quantity = useQuantity();
  const [load, setLoad] = useState(start);
  const chain = springChain(stiffness, load);
  const most = springChain(stiffness, Math.max(start * 2, 10)).total * 100;

  return (
    <VisualCard
      onReset={() => {
        setLoad(start);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.load}</span>}
          max={Math.max(start * 2, 10)}
          min={0}
          name={labels.loadName}
          onValueChange={setLoad}
          readout={<InlineMath math={quantity(load, "\\text{ N}", 0)} />}
          step={1}
          value={load}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={4} setting="lab">
          <Suspense fallback={null}>
            <SpringScene
              load={load}
              most={most}
              pair={chain.pair * 100}
              top={chain.top * 100}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.top}
            value={
              <InlineMath math={quantity(chain.top * 100, "\\text{ cm}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.pair}
            value={
              <InlineMath math={quantity(chain.pair * 100, "\\text{ cm}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.total}
            value={
              <InlineMath
                math={quantity(chain.total * 100, "\\text{ cm}", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
