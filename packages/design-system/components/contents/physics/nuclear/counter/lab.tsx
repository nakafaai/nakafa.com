import { Trace } from "@repo/design-system/components/contents/physics/bench/trace";
import { HalfLifeCounterScene } from "@repo/design-system/components/contents/physics/nuclear/counter/scene";
import {
  halfLifeFromReadings,
  recordedRate,
} from "@repo/design-system/components/contents/physics/nuclear/decay";
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
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

/** How many points the recorded curve is drawn through. */
const SAMPLES = 48;

interface HalfLifeCounterLabProps {
  /** The background count rate, in counts per minute. */
  background: number;
  description: NonNullable<ReactNode>;
  /** The first recorded count rate, background included, in counts per minute. */
  first: number;
  labels: {
    end: ReactNode;
    halfLife: ReactNode;
    start: ReactNode;
    viewLabel: string;
  };
  /** The later recorded count rate, background included, in counts per minute. */
  later: number;
  /** The time between the two readings, in hours. */
  time: number;
  title: NonNullable<ReactNode>;
}

/**
 * A Geiger-Muller counter in front of a radioactive sample records its rate
 * over time. The counter also records the background, which does not decay,
 * so the recorded curve levels off one background above zero. Subtract the
 * background and the sample's own rate halves once every half-life.
 */
export function HalfLifeCounterLab({
  background,
  description,
  first,
  labels,
  later,
  time,
  title,
}: HalfLifeCounterLabProps) {
  const quantity = useQuantity();
  const [progress, setProgress] = useState(0);
  const sample = halfLifeFromReadings({ first, later }, background, time);
  const rate = (hours: number) => recordedRate(sample, background, hours);

  return (
    <VisualCard
      onReset={() => {
        setProgress(0);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.8} setting="lab">
          <Suspense fallback={null}>
            <HalfLifeCounterScene
              background={background}
              halfLife={sample.halfLife}
              onProgress={setProgress}
              progress={progress}
              start={sample.start}
              time={time}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <Trace
          compare={{
            label: <InlineMath math="R_b" />,
            points: [
              { x: 0, y: background },
              { x: time, y: background },
            ],
          }}
          curve={{
            label: <InlineMath math="R(t)" />,
            points: Arr.makeBy(SAMPLES + 1, (index) => ({
              x: (index / SAMPLES) * time,
              y: rate((index / SAMPLES) * time),
            })),
          }}
          mark={{
            label: <InlineMath math="(t,\,R)" />,
            point: { x: progress * time, y: rate(progress * time) },
          }}
          x={{ caption: "t\\,(\\text{h})", domain: [0, time] }}
          y={{ caption: "R\\,(\\text{min}^{-1})", domain: [0, first] }}
        />
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.start}
            value={<InlineMath math={quantity(sample.start, "", 0)} />}
          />
          <VisualFactTabular
            label={labels.end}
            value={<InlineMath math={quantity(sample.end, "", 0)} />}
          />
          <VisualFactTabular
            label={labels.halfLife}
            value={
              <InlineMath math={quantity(sample.halfLife, "\\text{ h}", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
