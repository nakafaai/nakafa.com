"use client";

import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import {
  DEFAULT_PARABOLIC_LAUNCH_ID,
  formatAngleMath,
  getParabolicMotionState,
  isParabolicLaunchId,
  PARABOLIC_LAUNCHES,
  type ParabolicLaunchId,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import { getParabolicFacts } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/facts";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { SceneSpinner } from "@repo/design-system/components/three/placeholder";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { Array as Arr } from "effect";
import dynamic from "next/dynamic";
import { type ReactNode, useMemo, useState } from "react";

/** The scene loads once the lab asks for it, and its frame holds the place meanwhile. */
const ParabolicMovementStage = dynamic(
  () =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/stage"
    ).then(({ ParabolicMovementStage }) => ParabolicMovementStage),
  { loading: SceneSpinner }
);

interface ParabolicMovementLabProps {
  decimalSeparator?: DecimalSeparator;
  description?: ReactNode;
  labels: {
    chooseLaunch: string;
    factLabels: {
      flightTime: ReactNode;
      initialSpeed: ReactNode;
      peakHeight: ReactNode;
      range: ReactNode;
    };
    viewLabel: string;
  };
  /**
   * Whether the three-dimensional scene is mounted. A lab that is not live keeps
   * its whole card in place, with an empty frame where the scene goes.
   */
  live?: boolean;
  title?: ReactNode;
}

export function ParabolicMovementLab({
  decimalSeparator,
  title,
  description,
  labels,
  live = true,
}: ParabolicMovementLabProps) {
  const [launchId, setLaunchId] = useState<ParabolicLaunchId>(
    DEFAULT_PARABOLIC_LAUNCH_ID
  );
  const motion = useMemo(() => getParabolicMotionState(launchId), [launchId]);
  const facts = getParabolicFacts(motion, decimalSeparator, labels.factLabels);

  function handleLaunchChange(value: string) {
    if (!isParabolicLaunchId(value)) {
      return;
    }

    setLaunchId(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseLaunch}
          gridColumns="3"
          onValueChange={handleLaunchChange}
          type="single"
          value={launchId}
          variant="outline"
        >
          {Arr.map(PARABOLIC_LAUNCHES, (launch) => (
            <ToggleGroupItem key={launch.id} value={launch.id}>
              <InlineMath math={formatAngleMath(launch.angleDegrees)} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <VisualCardScene
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
          render={<section />}
        >
          {live ? <ParabolicMovementStage motion={motion} /> : null}
        </VisualCardScene>
      </VisualCardBody>

      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {Arr.map(facts, (fact) => (
            <VisualFactTabular
              key={fact.id}
              label={fact.label}
              value={<InlineMath math={fact.math} />}
            />
          ))}
        </dl>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
  );
}
