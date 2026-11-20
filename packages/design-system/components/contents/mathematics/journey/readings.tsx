import {
  meetingTex,
  momentTex,
  placeTex,
  rateTex,
  type Units,
} from "@repo/design-system/components/contents/mathematics/journey/readout";
import {
  lengthOf,
  type Motion,
  motionOf,
  partName,
  placeAt,
  type Stage,
  speedOf,
  type Traveller,
  totalsOf,
} from "@repo/design-system/components/contents/mathematics/journey/trip";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  VisualCardFacts,
  VisualCardFooter,
} from "@repo/design-system/components/visual/card";
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { JOURNEY_COLORS } from "@repo/design-system/lib/material/journey";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";

/** The words of the readouts, as the lesson writes them. */
interface ReadingLabels {
  /** The readout of the whole journey's average speed, such as "Average speed: total distance over total time". */
  readonly average: ReactNode;
  /** The readout of the bus's distance from the start, when it travels alone. */
  readonly distance: ReactNode;
  /** The readout of where and when two travellers meet. */
  readonly meeting?: ReactNode;
  /** What the bus does on a leg, in a sentence for each of its three motions. */
  readonly motion: Readonly<Record<Motion, ReactNode>>;
  /** The readout of a leg's speed, such as "Speed". */
  readonly speed: ReactNode;
  /** The readout of the clock. */
  readonly time: ReactNode;
  /** The units of distance, time and speed. */
  readonly units: Units;
}

/** A value the learner is asked to find, held back as a question mark. */
function Hidden() {
  return <span className="text-muted-foreground">?</span>;
}

/** How far from the start a traveller is at `minute`. */
function Distance({
  minute,
  stages,
  units,
}: {
  readonly minute: number;
  readonly stages: Arr.NonEmptyReadonlyArray<Stage>;
  readonly units: Units;
}) {
  const quantity = useQuantity();
  return (
    <InlineMath math={placeTex(placeAt(stages, minute), units, quantity)} />
  );
}

/**
 * The readouts under the scene: the clock, how far from the start each
 * traveller is, and where two travellers meet. Then the leg in focus, named
 * by its corners with what the bus does on it, and its speed worked out as
 * distance over time; with no leg in focus, the whole journey and its average
 * speed, the total distance over the total time. Without `showSpeeds`, as in
 * a question that asks for them, each speed is a question mark, and without
 * `showMeeting` so is the meeting.
 */
export function JourneyReadings({
  bus,
  focus,
  labels,
  meeting,
  second,
  showMeeting,
  showSpeeds,
}: {
  readonly bus: Traveller;
  readonly focus: {
    readonly minute: number;
    readonly part: Option.Option<number>;
  };
  readonly labels: ReadingLabels;
  readonly meeting: Option.Option<{
    readonly distance: number;
    readonly minute: number;
  }>;
  readonly second: Option.Option<Traveller>;
  readonly showMeeting: boolean;
  readonly showSpeeds: boolean;
}) {
  const quantity = useQuantity();
  const stages = bus.stages;

  return (
    <VisualCardFooter>
      <VisualCardFacts>
        <VisualFactTabular
          label={labels.time}
          value={
            <InlineMath
              math={momentTex(focus.minute, labels.units, quantity)}
            />
          }
        />
        {Option.match(second, {
          onNone: () => (
            <VisualFactTabular
              label={labels.distance}
              value={
                <Distance
                  minute={focus.minute}
                  stages={stages}
                  units={labels.units}
                />
              }
            />
          ),
          onSome: (other) => (
            <>
              <VisualFactTabular
                label={labels.meeting}
                value={Option.match(
                  Option.filter(meeting, () => showMeeting),
                  {
                    onNone: () => <Hidden />,
                    onSome: (met) => (
                      <InlineMath
                        math={meetingTex(met, labels.units, quantity)}
                      />
                    ),
                  }
                )}
              />
              <VisualFactIndicator
                indicatorColor={JOURNEY_COLORS.bus}
                label={bus.name}
                value={
                  <Distance
                    minute={focus.minute}
                    stages={stages}
                    units={labels.units}
                  />
                }
              />
              <VisualFactIndicator
                indicatorColor={JOURNEY_COLORS.bike}
                label={other.name}
                value={
                  <Distance
                    minute={focus.minute}
                    stages={other.stages}
                    units={labels.units}
                  />
                }
              />
            </>
          ),
        })}
        {Option.match(focus.part, {
          onNone: () => (
            <VisualFactTabular
              label={labels.average}
              value={
                <InlineMath
                  math={rateTex(
                    totalsOf(stages),
                    labels.units,
                    quantity,
                    showSpeeds
                  )}
                />
              }
            />
          ),
          onSome: (part) => {
            const stage = Arr.getUnsafe(stages, part);
            const rate = {
              distance: lengthOf(stage),
              minutes: stage.end - stage.start,
              speed: speedOf(stage),
            };
            return (
              <VisualFactTabular
                label={
                  <span>
                    <InlineMath math={partName(part)} />:{" "}
                    {labels.motion[motionOf(stage)]}
                  </span>
                }
                value={
                  <span>
                    {labels.speed}{" "}
                    <InlineMath
                      math={`= ${rateTex(rate, labels.units, quantity, showSpeeds)}`}
                    />
                  </span>
                }
              />
            );
          },
        })}
      </VisualCardFacts>
    </VisualCardFooter>
  );
}
