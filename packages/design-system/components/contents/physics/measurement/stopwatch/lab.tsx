import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import { TrialScene } from "@repo/design-system/components/contents/physics/measurement/stopwatch/scene";
import {
  MAX_TRIALS,
  timingSpread,
  trialTimes,
} from "@repo/design-system/components/contents/physics/measurement/stopwatch/trials";
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

interface StopwatchSpreadLabProps {
  /** How many trials are recorded first. */
  count?: number;
  description: NonNullable<ReactNode>;
  labels: {
    mean: ReactNode;
    spread: ReactNode;
    trials: string;
    uncertainty: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

/**
 * Ten swings of a pendulum timed by hand, trial after trial. Each reading
 * lands on a dot plot; the mean, the spread of single readings and the
 * uncertainty of the mean update as the trials pile up.
 */
export function StopwatchSpreadLab({
  count: initialCount = 10,
  description,
  labels,
  title,
}: StopwatchSpreadLabProps) {
  const [count, setCount] = useState(initialCount);
  const fixed = useFixed();
  const { mean, spread, uncertainty } = timingSpread(trialTimes(count));

  return (
    <VisualCard
      onReset={() => {
        setCount(initialCount);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.trials}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={`N=${count}`} />
            </span>
          </div>
          <Slider
            aria-label={labels.trials}
            max={MAX_TRIALS}
            min={2}
            onValueChange={setCount}
            step={1}
            value={count}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={16} setting="lab">
          <Suspense fallback={null}>
            <TrialScene count={count} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.mean}
            value={
              <InlineMath math={`\\bar t=${fixed(mean, "\\text{ s}", 3)}`} />
            }
          />
          <VisualFactTabular
            label={labels.spread}
            value={<InlineMath math={`s=${fixed(spread, "\\text{ s}", 3)}`} />}
          />
          <VisualFactTabular
            label={labels.uncertainty}
            value={
              <InlineMath
                math={`u(\\bar t)=${fixed(uncertainty, "\\text{ s}", 3)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
