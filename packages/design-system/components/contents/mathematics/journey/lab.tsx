import { HandSlider } from "@repo/design-system/components/contents/chemistry/slider";
import {
  lastMinute,
  minuteFocus,
  partFocus,
  wholeFocus,
} from "@repo/design-system/components/contents/mathematics/journey/clock";
import { JourneyGraph } from "@repo/design-system/components/contents/mathematics/journey/graph";
import { meetingOf } from "@repo/design-system/components/contents/mathematics/journey/meet";
import { JourneyReadings } from "@repo/design-system/components/contents/mathematics/journey/readings";
import type { Units } from "@repo/design-system/components/contents/mathematics/journey/readout";
import { JourneyScene } from "@repo/design-system/components/contents/mathematics/journey/scene";
import type {
  Leg,
  Motion,
} from "@repo/design-system/components/contents/mathematics/journey/trip";
import {
  partName,
  stagesOf,
} from "@repo/design-system/components/contents/mathematics/journey/trip";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useCallback, useMemo, useState } from "react";

/** The toolbar's choice of the whole journey, beside its legs. */
const WHOLE = "whole";

/** How far the diorama reaches from the middle of the table, in metres. */
const REACH = 0.5;

/**
 * A distance-time graph drawn by a journey. The scene is a road diorama: a
 * bus travels one straight road through its stops, past a post at every
 * kilometre mark. Under the scene, the graph plots the bus's distance from
 * the start against the clock. Each leg is a straight segment, named by its
 * corners: steep where the bus is fast, flat where it stands at a stop, and
 * falling where it heads back toward the start. The learner picks a leg, or
 * the whole journey, or drags the clock, and Play runs the journey and draws
 * the graph as it goes, the road, the graph and the readouts showing one
 * minute together. A leg in focus shows its rise and its run, and its speed
 * is worked out as distance over time; the whole journey's average speed is
 * its total distance over its total time.
 *
 * A second traveller, such as a motorbike that leaves later or from the other
 * end, drives the same road with its own line on the graph, and where the two
 * lines cross they meet. Without `showSpeeds`, as in a question that asks for
 * a speed, each speed stays a question mark; without `showMeeting`, so does
 * the meeting, and the crossing carries no mark.
 */
export function JourneyGraphLab({
  bus,
  description,
  labels,
  second,
  showMeeting = false,
  showSpeeds = false,
  stops = [],
  title,
}: {
  readonly bus: {
    readonly legs: readonly [Leg, ...Leg[]];
    readonly name: string;
  };
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly average: ReactNode;
    readonly axes: { readonly distance: string; readonly time: string };
    readonly distance: ReactNode;
    readonly meeting?: ReactNode;
    readonly motion: Readonly<Record<Motion, ReactNode>>;
    readonly parts: string;
    readonly speed: ReactNode;
    readonly time: string;
    readonly units: Units;
    readonly viewLabel: string;
    readonly whole: string;
  };
  readonly second?: {
    readonly depart: number;
    readonly from: number;
    readonly legs: readonly [Leg, ...Leg[]];
    readonly name: string;
  };
  readonly showMeeting?: boolean;
  readonly showSpeeds?: boolean;
  readonly stops?: readonly { readonly at: number; readonly name: string }[];
  readonly title: NonNullable<ReactNode>;
}) {
  const stages = useMemo(
    () => stagesOf({ depart: 0, from: 0, legs: bus.legs }),
    [bus.legs]
  );
  const other = useMemo(
    () =>
      Option.map(Option.fromUndefinedOr(second), (trip) => ({
        name: trip.name,
        stages: stagesOf(trip),
      })),
    [second]
  );
  const last = lastMinute(
    Option.match(other, {
      onNone: () => Arr.of(stages),
      onSome: (trip) => Arr.make(stages, trip.stages),
    })
  );
  const meeting = Option.flatMap(other, (trip) =>
    meetingOf(stages, trip.stages)
  );
  const [focus, setFocus] = useState(() => wholeFocus(last));
  const follow = useCallback(
    (minute: number) => setFocus(minuteFocus(stages, minute)),
    [stages]
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.parts}
          onValueChange={(value: string) => {
            if (value === WHOLE) {
              setFocus(wholeFocus(last));
              return;
            }
            Option.map(
              Arr.findFirstIndex(
                stages,
                (_stage, index) => String(index) === value
              ),
              (part) => setFocus(partFocus(stages, part))
            );
          }}
          type="single"
          value={Option.match(focus.part, {
            onNone: () => WHOLE,
            onSome: String,
          })}
          variant="outline"
        >
          <ToggleGroupItem value={WHOLE}>{labels.whole}</ToggleGroupItem>
          {Arr.map(stages, (stage, index) => (
            <ToggleGroupItem key={stage.start} value={String(index)}>
              {partName(index)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <HandSlider
          label={labels.time}
          max={last}
          onChange={follow}
          step={1}
          value={focus.minute}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={-0.03} ground="oak" reach={REACH} setting="studio">
          <Suspense fallback={null}>
            <JourneyScene
              minute={focus.minute}
              onMinute={follow}
              second={Option.map(other, (trip) => trip.stages)}
              stages={stages}
              stops={stops}
              units={labels.units}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <JourneyGraph
          bus={{ name: bus.name, stages }}
          focus={focus.part}
          meeting={Option.filter(meeting, () => showMeeting)}
          minute={focus.minute}
          second={other}
          titles={labels.axes}
          units={labels.units}
        />
        <JourneyReadings
          bus={{ name: bus.name, stages }}
          focus={focus}
          labels={labels}
          meeting={meeting}
          second={other}
          showMeeting={showMeeting}
          showSpeeds={showSpeeds}
        />
      </VisualCardFooter>
    </VisualCard>
  );
}
