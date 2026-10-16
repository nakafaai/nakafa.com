import {
  atLocalClock,
  digestInstant,
  LocalClock,
} from "@repo/backend/confect/notifications/clock";
import {
  Array as Arr,
  DateTime,
  Duration,
  Match,
  Option,
  Schema,
} from "effect";

/**
 * A kind of notice, one row of the channel table of ADR 0027. A kind is keyed by
 * what it tells a person, not by the journal change it may come from: one change
 * can feed two kinds, and a forum mention has no journal change at all.
 */
export const NoticeKind = Schema.Literals([
  "forumMention",
  "classAnnouncement",
  "taskPublished",
  "taskDeadline",
  "gradeReleased",
  "taskMissed",
  "examStart",
  "examGuardianReminder",
  "invitation",
]);

/**
 * How a recipient relates to the object of a notice: a student or a teacher of
 * its class, the guardian of a student, or the Person that an invitation names.
 */
export const Relation = Schema.Literals([
  "student",
  "teacher",
  "guardian",
  "invitee",
]);

/** A channel that reaches a person: the inbox row, a push, or an email. */
const Channel = Schema.Literals(["inbox", "push", "email"]);

/**
 * When a channel sends, relative to the anchor of its notice: the change that
 * caused it, the deadline of a task, or the opening of a sitting. `Now` sends at
 * the anchor. `Chosen` sends at the anchor only when the person who posted the
 * notice chose email for it. `Before` sends a whole number of minutes, zero or
 * more, before the anchor. `Clock` sends at a wall-clock time on a day of the
 * anchor's zone, and `Digest` sends at the 17:00 digest that carries the anchor.
 */
export const Timing = Schema.Union([
  Schema.TaggedStruct("Now", {}),
  Schema.TaggedStruct("Chosen", {}),
  Schema.TaggedStruct("Before", {
    minutes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
  Schema.TaggedStruct("Clock", LocalClock.fields),
  Schema.TaggedStruct("Digest", {}),
]);

/**
 * What one relation receives for a kind: the channels, each with the times it
 * sends. The inbox always has at least one time, because a row is never skipped.
 */
const Route = Schema.Struct({
  email: Schema.optionalKey(Schema.NonEmptyArray(Timing)),
  inbox: Schema.NonEmptyArray(Timing),
  push: Schema.optionalKey(Schema.NonEmptyArray(Timing)),
  relation: Relation,
});

/**
 * Whether each relation has at most one route. A second route for a relation
 * would never be read, so the Schema of a rule refuses it.
 */
const hasOneRoutePerRelation = (
  routes: readonly (typeof Route.Type)[]
): boolean => {
  const relations = Arr.map(routes, (route) => route.relation);
  return Arr.dedupe(relations).length === relations.length;
};

/**
 * The rule of one kind: the routes it has, one for each relation it reaches,
 * and the channels that stay on, because no preference can switch them off.
 */
const NoticeRule = Schema.Struct({
  alwaysSent: Schema.optionalKey(Schema.Array(Channel)),
  routes: Schema.Array(Route).check(
    Schema.makeFilter(hasOneRoutePerRelation, {
      message: "A kind holds one route for each relation.",
    })
  ),
});

/** One rule for every kind: a kind without a row does not compile. */
export const NoticeRules = Schema.Record(NoticeKind, NoticeRule);

const NOW: typeof Timing.Type = { _tag: "Now" };
const CHOSEN: typeof Timing.Type = { _tag: "Chosen" };
const DIGEST: typeof Timing.Type = { _tag: "Digest" };
const ONE_HOUR_BEFORE: typeof Timing.Type = { _tag: "Before", minutes: 60 };
const FIFTEEN_MINUTES_BEFORE: typeof Timing.Type = {
  _tag: "Before",
  minutes: 15,
};
/** 16:00 on the day before a deadline (ADR 0027, a proposal the owner sets). */
const DAY_BEFORE_AT_16: typeof Timing.Type = {
  _tag: "Clock",
  dayOffset: -1,
  hour: 16,
  minute: 0,
};
/** 06:30 on the day of an exam, for a guardian (ADR 0027). */
const EXAM_DAY_AT_0630: typeof Timing.Type = {
  _tag: "Clock",
  dayOffset: 0,
  hour: 6,
  minute: 30,
};

/**
 * The channel table of ADR 0027, as data. Each kind lists its routes, and each
 * route names one relation with the channels it receives and their times. A
 * forum mention never reaches a guardian, a late task reaches only the guardian,
 * and an invitation email is always sent.
 */
export const NOTICE_RULES: typeof NoticeRules.Type = {
  forumMention: {
    routes: [
      { relation: "student", inbox: [NOW], push: [NOW], email: [DIGEST] },
      { relation: "teacher", inbox: [NOW], push: [NOW], email: [DIGEST] },
    ],
  },
  classAnnouncement: {
    routes: [
      { relation: "student", inbox: [NOW], push: [NOW], email: [CHOSEN] },
    ],
  },
  taskPublished: {
    routes: [
      { relation: "student", inbox: [NOW], push: [NOW], email: [DIGEST] },
    ],
  },
  taskDeadline: {
    routes: [
      {
        relation: "student",
        inbox: [DAY_BEFORE_AT_16, ONE_HOUR_BEFORE],
        push: [DAY_BEFORE_AT_16, ONE_HOUR_BEFORE],
      },
    ],
  },
  gradeReleased: {
    routes: [
      { relation: "student", inbox: [NOW], push: [NOW] },
      { relation: "guardian", inbox: [NOW], push: [NOW], email: [NOW] },
    ],
  },
  taskMissed: {
    routes: [{ relation: "guardian", inbox: [NOW], push: [NOW], email: [NOW] }],
  },
  examStart: {
    routes: [
      {
        relation: "student",
        inbox: [FIFTEEN_MINUTES_BEFORE],
        push: [FIFTEEN_MINUTES_BEFORE],
        email: [FIFTEEN_MINUTES_BEFORE],
      },
    ],
  },
  examGuardianReminder: {
    routes: [
      {
        relation: "guardian",
        inbox: [EXAM_DAY_AT_0630],
        email: [EXAM_DAY_AT_0630],
      },
    ],
  },
  invitation: {
    alwaysSent: ["email"],
    routes: [{ relation: "invitee", inbox: [NOW], email: [NOW] }],
  },
};

/**
 * The route of one relation for a kind, or none when the kind sends nothing to
 * that relation.
 */
const routeOf = (
  kind: typeof NoticeKind.Type,
  relation: typeof Relation.Type
): Option.Option<typeof Route.Type> =>
  Arr.findFirst(
    NOTICE_RULES[kind].routes,
    (route) => route.relation === relation
  );

/**
 * The people of `people` who receive a notice of `kind`: those whose relation
 * has a route for that kind. Each person keeps the fields the caller gave.
 */
export const recipientsOf = <
  Person extends { readonly relation: typeof Relation.Type },
>(
  kind: typeof NoticeKind.Type,
  people: readonly Person[]
): readonly Person[] =>
  Arr.filter(people, (person) => Option.isSome(routeOf(kind, person.relation)));

/**
 * Whether a person may switch a channel of a kind off. The inbox is never
 * switched off, because a row is never skipped, and a channel the rule always
 * sends stays on, as the invitation and account email does (ADR 0027).
 */
export const canSwitchOff = (
  kind: typeof NoticeKind.Type,
  channel: typeof Channel.Type
): boolean =>
  channel !== "inbox" &&
  !Arr.contains(NOTICE_RULES[kind].alwaysSent ?? [], channel);

/**
 * One send that a notice makes to a person: the channel it goes out on, and the
 * instant it is due.
 */
const Delivery = Schema.Struct({
  channel: Channel,
  instant: Schema.DateTimeUtc,
});

/**
 * The instant a timing sends for a notice, given its anchor and the zone of the
 * notice. A `Clock` time and a `Digest` read the calendar on the clock of `zone`.
 */
const deliveryInstant = (
  timing: typeof Timing.Type,
  anchor: DateTime.Utc,
  zone: DateTime.TimeZone.Named
): DateTime.Utc =>
  Match.value(timing).pipe(
    Match.tagsExhaustive({
      Now: () => anchor,
      Chosen: () => anchor,
      Before: ({ minutes }) =>
        DateTime.subtractDuration(anchor, Duration.minutes(minutes)),
      Clock: (clock) => atLocalClock(anchor, zone, clock),
      Digest: () => digestInstant(anchor, zone),
    })
  );

/**
 * The sends that a notice of `kind` makes to a person of `relation`, each with
 * its channel and its instant, in the order of the channel table: inbox, push,
 * then email. A relation with no route gets none. `emailChosen` says whether the
 * poster chose email for the notice, and only a `Chosen` send depends on it.
 */
export const deliveriesOf = (
  kind: typeof NoticeKind.Type,
  relation: typeof Relation.Type,
  anchor: DateTime.Utc,
  zone: DateTime.TimeZone.Named,
  emailChosen: boolean
): readonly (typeof Delivery.Type)[] => {
  const sendsOn = (
    channel: typeof Channel.Type,
    timings: readonly (typeof Timing.Type)[]
  ) =>
    Arr.map(
      Arr.filter(timings, (timing) => timing._tag !== "Chosen" || emailChosen),
      (timing) => ({ channel, instant: deliveryInstant(timing, anchor, zone) })
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
