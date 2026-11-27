import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import { GaugeScene } from "@repo/design-system/components/contents/physics/measurement/micrometer/scene";
import {
  micrometerReading,
  SCREW_RANGE,
  SCREW_RESOLUTION,
} from "@repo/design-system/components/contents/physics/measurement/micrometer/screw";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
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

interface MicrometerScrewLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    division: ReactNode;
    reading: ReactNode;
    size: string;
    sleeve: ReactNode;
    viewLabel: string;
  };
  /** The size of the ball the gauge first holds, in millimetres. */
  thickness?: number;
  title: NonNullable<ReactNode>;
}

/**
 * A micrometer screw gauge closed on a steel ball, with a magnifier on its
 * sleeve and thimble. The sleeve gives whole and half millimetres; the
 * thimble division on the datum line adds hundredths of a millimetre.
 */
export function MicrometerScrewLab({
  description,
  labels,
  thickness: initialThickness = 6.35,
  title,
}: MicrometerScrewLabProps) {
  const [thickness, setThickness] = useState(initialThickness);
  const fixed = useFixed();
  const { division, reading, sleeve } = micrometerReading(thickness);

  return (
    <VisualCard
      onReset={() => {
        setThickness(initialThickness);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.size}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={fixed(reading, "\\text{ mm}", 2)} />
            </span>
          </div>
          <Slider
            aria-label={labels.size}
            max={SCREW_RANGE.max}
            min={SCREW_RANGE.min}
            onValueChange={setThickness}
            step={SCREW_RESOLUTION}
            value={thickness}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={1.1} setting="lab">
          <Suspense fallback={null}>
            <GaugeScene sleeve={sleeve} thickness={reading} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.sleeve}
            value={<InlineMath math={fixed(sleeve, "\\text{ mm}", 1)} />}
          />
          <VisualFactTabular
            label={labels.division}
            value={<InlineMath math={`${division}`} />}
          />
          <VisualFactTabular
            label={labels.reading}
            value={
              <InlineMath
                math={`${fixed(sleeve, "", 1)}+${division}\\times${fixed(SCREW_RESOLUTION, "", 2)}=${fixed(reading, "\\text{ mm}", 2)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
