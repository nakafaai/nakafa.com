import { formatSigned } from "@repo/design-system/components/contents/physics/vector/concept/data";
import { VectorConceptScene } from "@repo/design-system/components/contents/physics/vector/concept/scene";
import {
  getVectorState,
  LOAD_MAX_X,
  LOAD_MIN_X,
  LOAD_STEP,
} from "@repo/design-system/components/contents/physics/vector/concept/tension";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinates";
import { StageProvider } from "@repo/design-system/components/three/stage/context";
import {
  SETTING_SUNS,
  StudioSetting,
} from "@repo/design-system/components/three/stage/settings";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  VisualCard,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { Effect } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

/** How far the gantry reaches from its middle, which the studio's light and shadows cover. */
const REACH = 3.4;

/** How far the axes and the grid run from the origin before they end. */
const AXES = 12;

export interface VectorConceptLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    bridgeView: string;
    chooseLoadPosition: string;
    direction: string;
    directionValue: string;
    leftCable: ReactNode;
    magnitude: string;
    magnitudeValue: string;
    netIdea: string;
    netIdeaValue: string;
    rightCable: ReactNode;
  };
  title: NonNullable<ReactNode>;
}

/**
 * A crate hung by two cables between the towers of a gantry, drawn in the
 * shared coordinate system: the X axis runs along the deck in metres, so the
 * slider's position reads off its ticks, and Y measures height. The learner
 * slides the load and sees each cable's tension as a vector whose length is
 * its magnitude and whose tilt is its direction.
 */
export function VectorConceptLab({
  title,
  description,
  labels,
}: VectorConceptLabProps) {
  const [loadX, setLoadX] = useState(0);
  const vectorState = useMemo(
    () => Effect.runSync(getVectorState(loadX)),
    [loadX]
  );

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <VisualCardToolbar>
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center justify-between gap-4 text-sm">
              <div>{labels.chooseLoadPosition}</div>
              <div className="shrink-0 tabular-nums">
                <InlineMath math={`${formatSigned(loadX)} \\text{ m}`} />
              </div>
            </div>
            <Slider
              aria-label={labels.chooseLoadPosition}
              max={LOAD_MAX_X}
              min={LOAD_MIN_X}
              onValueChange={setLoadX}
              step={LOAD_STEP}
              value={loadX}
            />
          </div>
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.bridgeView}
          cameraPosition={[1.3, 2.2, 5.6]}
          cameraTarget={[0, 1.55, 0]}
          focus={{
            x: { max: 3.1, min: -3.1 },
            y: { max: 3.1, min: 0 },
            z: { max: 0.5, min: -0.5 },
          }}
          reach={AXES}
          showZAxis
          ticks
        >
          <StageProvider
            floor={0}
            ground={undefined}
            reach={REACH}
            sun={SETTING_SUNS.studio}
          >
            <StudioSetting />
            <Suspense fallback={null}>
              <VectorConceptScene labels={labels} vectorState={vectorState} />
            </Suspense>
          </StageProvider>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VisualCardFacts>
            <VisualFact
              label={labels.magnitude}
              value={labels.magnitudeValue}
            />
            <VisualFact
              label={labels.direction}
              value={labels.directionValue}
            />
            <VisualFact label={labels.netIdea} value={labels.netIdeaValue} />
          </VisualCardFacts>
        </VisualCardFooter>
      </VisualCard>
    </CoordinateProvider>
  );
}
