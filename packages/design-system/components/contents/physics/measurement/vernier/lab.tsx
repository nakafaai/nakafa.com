import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import {
  CALIPER_RANGE,
  VERNIER_RESOLUTION,
  vernierReading,
} from "@repo/design-system/components/contents/physics/measurement/vernier/caliper";
import { CaliperScene } from "@repo/design-system/components/contents/physics/measurement/vernier/scene";
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

interface VernierCaliperLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    centimetres: ReactNode;
    line: ReactNode;
    main: ReactNode;
    reading: ReactNode;
    viewLabel: string;
    width: string;
  };
  title: NonNullable<ReactNode>;
  /** The width of the object the caliper first holds, in millimetres. */
  width?: number;
}

/**
 * A vernier caliper closed on a brass cylinder, seen from over its scales.
 * Slide the jaw: the vernier zero gives the whole millimetres, and the one
 * vernier line that meets a main mark gives the tenth.
 */
export function VernierCaliperLab({
  description,
  labels,
  title,
  width: initialWidth = 18.4,
}: VernierCaliperLabProps) {
  const [width, setWidth] = useState(initialWidth);
  const fixed = useFixed();
  const { line, main, reading } = vernierReading(width);

  return (
    <VisualCard
      onReset={() => {
        setWidth(initialWidth);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.width}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={fixed(reading, "\\text{ mm}", 1)} />
            </span>
          </div>
          <Slider
            aria-label={labels.width}
            max={CALIPER_RANGE.max}
            min={CALIPER_RANGE.min}
            onValueChange={setWidth}
            step={VERNIER_RESOLUTION}
            value={width}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={0.9} setting="lab">
          <Suspense fallback={null}>
            <CaliperScene line={line} main={main} width={reading} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.main}
            value={<InlineMath math={fixed(main, "\\text{ mm}", 0)} />}
          />
          <VisualFactTabular
            label={labels.line}
            value={<InlineMath math={`${line}`} />}
          />
          <VisualFactTabular
            label={labels.reading}
            value={
              <InlineMath
                math={`${main}+${line}\\times${fixed(VERNIER_RESOLUTION, "", 1)}=${fixed(reading, "\\text{ mm}", 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.centimetres}
            value={<InlineMath math={fixed(reading / 10, "\\text{ cm}", 2)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
