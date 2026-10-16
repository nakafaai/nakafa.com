import {
  atLocalClock,
  digestInstant,
} from "@repo/backend/confect/notifications/clock";
import {
  Channel,
  type NoticeKind,
  type Relation,
  routeOf,
  Timing,
} from "@repo/backend/confect/notifications/rules";
import {
  Array as Arr,
  DateTime,
  Duration,
  Match,
  Option,
  Schema,
} from "effect";

/**
 * One send that a notice makes to a person: the channel it goes out on, and the
 * Timing that says when. It holds no instant: `deliveryInstant` derives the
 * instant when the send is read, so a pending send keeps its rule.
 */
const Delivery = Schema.Struct({
  channel: Channel,
  timing: Timing,
});

/** The instant a whole number of minutes before `anchor`, in elapsed time. */
const minutesBefore = (anchor: DateTime.Utc, minutes: number): DateTime.Utc =>
  DateTime.subtractDuration(anchor, Duration.minutes(minutes));

/**
 * The instant at which a send of a notice is due. It is the one function that
 * turns a Timing into an instant. It takes the anchor of the notice, the Timing,
 * and the zone of the school at the moment the send is read. A `Clock` time and
 * a `Digest` read the calendar on the clock of `zone`, so a pending send moves
 * with the zone of its school (ADR 0027).
 */
export const deliveryInstant = (
  anchor: DateTime.Utc,
  timing: typeof Timing.Type,
  zone: DateTime.TimeZone.Named
): DateTime.Utc =>
  Match.value(timing).pipe(
    Match.tagsExhaustive({
      Now: () => anchor,
      Chosen: () => anchor,
      Before: ({ minutes }) => minutesBefore(anchor, minutes),
      Clock: (clock) => atLocalClock(anchor, zone, clock),
      Digest: () => digestInstant(anchor, zone),
      EarlierOf: ({ clock, minutes }) =>
        DateTime.min(
          atLocalClock(anchor, zone, clock),
          minutesBefore(anchor, minutes)
        ),
    })
  );

/**
 * The sends that a notice of `kind` makes to a person of `relation`, each with
 * its channel and its Timing, in the order of the channel table: inbox, push,
 * then email. A relation with no route gets none. `emailChosen` says whether the
 * poster chose email for the notice, and only a `Chosen` send depends on it.
 */
export const deliveriesOf = (
  kind: typeof NoticeKind.Type,
  relation: typeof Relation.Type,
  emailChosen: boolean
): readonly (typeof Delivery.Type)[] => {
  const sendsOn = (
    channel: typeof Channel.Type,
    timings: readonly (typeof Timing.Type)[]
  ) =>
    Arr.map(
      Arr.filter(timings, (timing) => timing._tag !== "Chosen" || emailChosen),
      (timing) => ({ channel, timing })
    );
  return Option.match(routeOf(kind, relation), {
    onNone: () => [],
    onSome: (route) =>
      Arr.flatten([
        sendsOn("inbox", route.inbox),
        sendsOn("push", route.push ?? []),
        sendsOn("email", route.email ?? []),
      ]),
  });
};
