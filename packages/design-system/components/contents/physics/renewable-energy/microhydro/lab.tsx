import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { MicrohydroScene } from "@repo/design-system/components/contents/physics/renewable-energy/microhydro/scene";
import {
  FLOW,
  HEAD,
  HOMES,
  homesLit,
  plantPower,
} from "@repo/design-system/components/contents/physics/renewable-energy/microhydro/stream";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
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
import { type ReactNode, Suspense, useState } from "react";

interface MicrohydroLabProps {
  description: ReactNode;
  /** The flow at first, in litres per second. */
  flow?: number;
  /** The head at first, in metres. */
  head?: number;
  labels: {
    flowControl: string;
    headControl: string;
    homes: ReactNode;
    power: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A microhydro plant on a hillside at dusk. Water drops from the intake
 * through the head to a small powerhouse, and P ≈ ρ g Q h η sets how many of
 * the hamlet's 16 homes, at 250 W each, can light up. Twice the flow or twice
 * the head doubles the power.
 */
export function MicrohydroLab({
  description,
  flow: initialFlow = 20,
  head: initialHead = 10,
  labels,
  title,
}: MicrohydroLabProps) {
  const [flow, setFlow] = useState(initialFlow);
  const [head, setHead] = useState(initialHead);
  const measure = useQuantity();
  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.flowControl}
          max={FLOW.max}
          min={FLOW.min}
          name={labels.flowControl}
          onValueChange={setFlow}
          readout={<InlineMath math={measure(flow, "\\text{ L/s}", 0)} />}
          step={FLOW.step}
          value={flow}
        />
        <LabSlider
          label={labels.headControl}
          max={HEAD.max}
          min={HEAD.min}
          name={labels.headControl}
          onValueChange={setHead}
          readout={<InlineMath math={measure(head, "\\text{ m}", 0)} />}
          step={HEAD.step}
          value={head}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={12} setting="field">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[9, 9, 22]}
              cameraTarget={[3.5, 1.5, 0]}
              fov={38}
              maxDistance={44}
              minDistance={6}
            />
            <MicrohydroScene flow={flow} head={head} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath
                math={measure(plantPower(flow, head), "\\text{ W}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.homes}
            value={
              <InlineMath
                math={`${measure(homesLit(flow, head), "", 0)}\\ /\\ ${measure(HOMES, "", 0)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
