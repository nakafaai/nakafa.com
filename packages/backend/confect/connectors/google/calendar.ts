import { GoogleFailed } from "@repo/backend/confect/connectors/errors";
import { GOOGLE_DEADLINE } from "@repo/backend/confect/connectors/google/oauth";
import type { CalendarEvent } from "@repo/backend/confect/connectors/schema";
import {
  Array as Arr,
  DateTime,
  Duration,
  Effect,
  Option,
  Schema,
} from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

/** The events endpoint of the account's primary calendar. */
const EVENTS_ENDPOINT =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** How far ahead a sync reads: the coming 14 days. */
export const CALENDAR_WINDOW = Duration.days(14);

/** The most events one sync keeps. */
export const CALENDAR_LIMIT = 100;

/** When an event starts or ends, as Google writes it: a day for an all-day event, a time for any other. */
const EventTime = Schema.Struct({
  date: Schema.optionalKey(Schema.String),
  dateTime: Schema.optionalKey(Schema.String),
});

/** One page of events as Google answers it. Only the fields a sync keeps are read. */
const EventsAnswer = Schema.fromJsonString(
  Schema.Struct({
    items: Schema.Array(
      Schema.Struct({
        end: EventTime,
        id: Schema.NonEmptyString,
        start: EventTime,
        status: Schema.optionalKey(Schema.String),
        summary: Schema.optionalKey(Schema.String),
      })
    ),
  })
);

/** The instant of an event time, and whether it is a whole day. A time Google wrote without either is none. */
const instantOf = (time: typeof EventTime.Type) =>
  Option.map(
    Option.firstSomeOf([
      Option.flatMap(Option.fromUndefinedOr(time.dateTime), DateTime.make),
      Option.flatMap(Option.fromUndefinedOr(time.date), DateTime.make),
    ]),
    (instant) => ({
      allDay: time.dateTime === undefined,
      at: DateTime.toEpochMillis(instant),
    })
  );

/**
 * The account's events of the coming days, from its primary calendar: each
 * occurrence of a repeating event apart, in the order they start, without a
 * cancelled one. Google refusing the access token fails as `revoked`, so the
 * connection waits for its owner to connect again.
 */
export const upcomingEvents = Effect.fn("connectors.google.calendar")(
  function* (accessToken: string, now: number) {
    const url = new URL(EVENTS_ENDPOINT);
    url.search = new URLSearchParams({
      maxResults: String(CALENDAR_LIMIT),
      orderBy: "startTime",
      singleEvents: "true",
      timeMax: DateTime.formatIso(
        DateTime.makeUnsafe(now + Duration.toMillis(CALENDAR_WINDOW))
      ),
      timeMin: DateTime.formatIso(DateTime.makeUnsafe(now)),
    }).toString();
    const response = yield* (yield* HttpClient.HttpClient)
      .execute(
        HttpClientRequest.get(url).pipe(
          HttpClientRequest.bearerToken(accessToken)
        )
      )
      .pipe(
        Effect.timeout(GOOGLE_DEADLINE),
        Effect.mapError(() => new GoogleFailed({ reason: "unreached" }))
      );
    if (response.status === 401) {
      return yield* new GoogleFailed({ reason: "revoked", status: 401 });
    }
    if (response.status < 200 || response.status >= 300) {
      return yield* new GoogleFailed({
        reason: "refused",
        status: response.status,
      });
    }
    const answer = yield* response.text.pipe(
      Effect.flatMap(Schema.decodeEffect(EventsAnswer)),
      Effect.mapError(() => new GoogleFailed({ reason: "invalid" }))
    );
    return Arr.getSomes(
      Arr.map(answer.items, (item) =>
        item.status === "cancelled"
          ? Option.none()
          : Option.map(
              Option.all({
                end: instantOf(item.end),
                start: instantOf(item.start),
              }),
              ({ end, start }): typeof CalendarEvent.Type => ({
                allDay: start.allDay,
                end: end.at,
                eventId: item.id,
                start: start.at,
                title: item.summary ?? "",
              })
            )
      )
    );
  },
  Effect.scoped
);
