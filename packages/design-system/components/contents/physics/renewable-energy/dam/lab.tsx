import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  HEAD,
  inletSpeed,
  stagePowers,
} from "@repo/design-system/components/contents/physics/renewable-energy/dam/chain";
import { DamScene } from "@repo/design-system/components/contents/physics/renewable-energy/dam/scene";
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
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { type ReactNode, Suspense, useState } from "react";

/** The color of each stage of the chain, shared by the bars and the facts. */
const STAGE_COLORS = {
  electric: PLOT_COLORS.orange,
  kinetic: PLOT_COLORS.teal,
  potential: PLOT_COLORS.amber,
  shaft: PLOT_COLORS.violet,
} as const;

interface HydroDamLabProps {
  description: ReactNode;
  /** The head the dam holds first, in metres. */
  head?: number;
  labels: {
    electric: ReactNode;
    head: ReactNode;
    headControl: string;
    kinetic: ReactNode;
    potential: ReactNode;
    shaft: ReactNode;
    speed: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A hydropower dam in cross-section. Every second 10 m³ of water drops
 * through the head: its gravitational potential energy becomes kinetic
 * energy at the turbine, rotation of the shaft, then electricity. The bars
 * show each stage's power, and only the turbine and generator keep a share.
 */
export function HydroDamLab({
  description,
  head: initialHead = 50,
  labels,
  title,
}: HydroDamLabProps) {
  const [head, setHead] = useState(initialHead);
  const measure = useQuantity();
  const stages = stagePowers(head);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
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
        <ScienceStage floor={0} frameloop="always" reach={14} setting="field">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[17, 11, 21]}
              cameraTarget={[0, 3.5, 0]}
              fov={36}
              maxDistance={48}
              minDistance={8}
            />
            <DamScene colors={STAGE_COLORS} head={head} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.head}
            value={<InlineMath math={measure(head, "\\text{ m}", 0)} />}
          />
          <VisualFactTabular
            label={labels.speed}
            value={
              <InlineMath math={measure(inletSpeed(head), "\\text{ m/s}", 1)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={STAGE_COLORS.potential}
            label={labels.potential}
            value={
              <InlineMath
                math={measure(stages.potential / 1e6, "\\text{ MW}", 2)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={STAGE_COLORS.kinetic}
            label={labels.kinetic}
            value={
              <InlineMath
                math={measure(stages.kinetic / 1e6, "\\text{ MW}", 2)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={STAGE_COLORS.shaft}
            label={labels.shaft}
            value={
              <InlineMath
                math={measure(stages.shaft / 1e6, "\\text{ MW}", 2)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={STAGE_COLORS.electric}
            label={labels.electric}
            value={
              <InlineMath
                math={measure(stages.electric / 1e6, "\\text{ MW}", 2)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
