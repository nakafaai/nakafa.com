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
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
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
  /** The launch the lab opens on. It starts at the default launch when none is given. */
  defaultLaunchId?: ParabolicLaunchId | undefined;
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
  live?: boolean;
  /**
   * Whether the three-dimensional scene is mounted. A lab that is not live keeps
   * its whole card in place, with an empty frame where the scene goes.
   */
  /** Reports each launch the reader picks, so a window can keep it while this lab is unmounted. */
  onLaunchIdChange?: (launchId: ParabolicLaunchId) => void;
  title?: ReactNode;
}

export function ParabolicMovementLab({
  decimalSeparator,
  defaultLaunchId,
  onLaunchIdChange,
  title,
  description,
  labels,
  live = true,
}: ParabolicMovementLabProps) {
  const [launchId, setLaunchId] = useState<ParabolicLaunchId>(
    defaultLaunchId ?? DEFAULT_PARABOLIC_LAUNCH_ID
  );
  const motion = useMemo(() => getParabolicMotionState(launchId), [launchId]);
  const facts = getParabolicFacts(motion, decimalSeparator, labels.factLabels);

  function handleLaunchChange(value: string) {
    if (!isParabolicLaunchId(value)) {
      return;
    }

    setLaunchId(value);
    onLaunchIdChange?.(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
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
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        {live ? <ParabolicMovementStage motion={motion} /> : null}
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {Arr.map(facts, (fact) => (
            <VisualFactTabular
              key={fact.id}
              label={fact.label}
              value={<InlineMath math={fact.math} />}
            />
          ))}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
