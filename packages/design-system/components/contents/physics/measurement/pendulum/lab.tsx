import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import {
  BOBS,
  GRAVITY,
  pendulumPeriod,
  STRING_RANGE,
} from "@repo/design-system/components/contents/physics/measurement/pendulum/period";
import { SwingScene } from "@repo/design-system/components/contents/physics/measurement/pendulum/scene";
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

interface PendulumPeriodLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    check: ReactNode;
    gravity: ReactNode;
    length: string;
    masses: ReactNode;
    period: ReactNode;
    viewLabel: string;
  };
  /** The strings' length at first, in metres. */
  length?: number;
  title: NonNullable<ReactNode>;
}

/**
 * Three pendulums of one length with a 50 g wooden bob, a 200 g brass bob
 * and a 500 g lead bob. They swing in step at every length, and a four times
 * longer string doubles their period: the period is 2π √(l/g), with mass to
 * the power zero, just as dimensional analysis predicts.
 */
export function PendulumPeriodLab({
  description,
  labels,
  length: initialLength = 0.8,
  title,
}: PendulumPeriodLabProps) {
  const [length, setLength] = useState(initialLength);
  const fixed = useFixed();
  const period = pendulumPeriod(length, BOBS.brass.mass);

  return (
    <VisualCard
      onReset={() => {
        setLength(initialLength);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.length}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={`l=${fixed(length, "\\text{ m}", 2)}`} />
            </span>
          </div>
          <Slider
            aria-label={labels.length}
            max={STRING_RANGE.max}
            min={STRING_RANGE.min}
            onValueChange={setLength}
            step={0.05}
            value={length}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={9} setting="lab">
          <Suspense fallback={null}>
            <SwingScene length={length} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.masses}
            value={
              <InlineMath
                math={`${fixed(BOBS.wood.mass * 1000, "\\text{ g}", 0)};\\ ${fixed(BOBS.brass.mass * 1000, "\\text{ g}", 0)};\\ ${fixed(BOBS.lead.mass * 1000, "\\text{ g}", 0)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.gravity}
            value={
              <InlineMath math={`g=${fixed(GRAVITY, "\\text{ m/s}^2", 2)}`} />
            }
          />
          <VisualFactTabular
            label={labels.period}
            value={
              <InlineMath
                math={`T=2\\pi\\sqrt{\\frac{l}{g}}=${fixed(period, "\\text{ s}", 2)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.check}
            value={
              <InlineMath math="[\mathrm{M}]^0[\mathrm{L}]^{\frac12}\left([\mathrm{L}][\mathrm{T}]^{-2}\right)^{-\frac12}=[\mathrm{T}]" />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
