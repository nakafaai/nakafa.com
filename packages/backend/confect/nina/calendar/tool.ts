import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { denied } from "@repo/backend/confect/nina/policy/capability";
import {
  Array as Arr,
  Clock,
  DateTime,
  Duration,
  Effect,
  Schema,
} from "effect";

/**
 * Why the calendar capability is denied: the learner has not connected Google
 * Calendar. The policy decides it for a turn from its context.
 */
export const CALENDAR_OFF = denied(
  "The learner has not connected Google Calendar, so their events are not available. Tell the learner they can connect it in Settings, Connectors."
);

/** The calendar could not be read. It keeps nothing of the failure. */
export class CalendarReadError extends Schema.TaggedError<CalendarReadError>()(
  "CalendarReadError",
  {}
) {}

/** Ends a read that failed in any way, without its message. */
function unreadable() {
  return new CalendarReadError();
}

/** What Nina reads when the window holds no event. */
const NOTHING =
  "The learner's Google Calendar has no event in this window. Say so; do not guess one.";

/** One event as Nina reads it: its day or its times in UTC, and its title. */
const lineOf = (event: {
  readonly allDay: boolean;
  readonly end: number;
  readonly start: number;
  readonly title: string;
}) => {
  const start = DateTime.makeUnsafe(event.start);
  const end = DateTime.makeUnsafe(event.end);
  const when = event.allDay
    ? `all day from ${DateTime.formatIsoDate(start)} to ${DateTime.formatIsoDate(end)}`
    : `${DateTime.formatIso(start)} to ${DateTime.formatIso(end)}`;
  return `- ${when}: ${event.title === "" ? "(no title)" : event.title}`;
};

/**
 * Runs the calendar capability: the learner's own events of the coming `days`,
 * the soonest first, from the mirror that the Calendar sync keeps, in one read.
 * It calls no model and no Google API, and it reads only the events of the
 * learner the turn belongs to. Times are in UTC, which the answer says, so Nina
 * names them in the learner's own time. The titles are the learner's data, so
 * the capability declares a note and the conversation stores the note, never
 * the titles (see `calendarCapability`).
 */
export const runCalendar = Effect.fn("nina.calendar.tool")(function* ({
  days,
  userId,
}: {
  readonly days: number;
  readonly userId: Docs["users"]["_id"];
}) {
  const now = yield* Clock.currentTimeMillis;
  const events = yield* (yield* QueryRunner)
    .runQuery(refs.internal.connectors.events.upcoming, {
      from: now,
      until: now + Duration.toMillis(Duration.days(days)),
      userId,
    })
    .pipe(
      Effect.mapError(unreadable),
      Effect.catchDefect(() => Effect.fail(unreadable()))
    );
  if (!Arr.isReadonlyArrayNonEmpty(events)) {
    return { outcome: "empty" as const, text: NOTHING };
  }
  return {
    text: Arr.join(
      [
        `The learner's Google Calendar for the next ${days} days, times in UTC:`,
        ...Arr.map(events, lineOf),
      ],
      "\n"
    ),
  };
});
