import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { namedTimeZone } from "@repo/utilities/timezone";
import { DateTime, Effect, Option, Schema } from "effect";

/**
 * The shapes in which a class writes a school's time: a date, a time, a date
 * and a time, or a relative day, which reads `today` or `yesterday` and falls
 * back to the date on any other day.
 */
export const SchoolTimeFormat = Schema.Literals([
  "date",
  "dateTime",
  "relativeDay",
  "time",
]);

export type SchoolTimeFormat = typeof SchoolTimeFormat.Type;

/**
 * What a school time is written from: the instant, the school's time zone as an
 * IANA name, the interface locale, and the current instant. The caller reads
 * `now` through `Clock`, and only a relative day uses it.
 */
const SchoolTimeRequest = Schema.Struct({
  format: SchoolTimeFormat,
  instant: Schema.DateTimeUtc,
  locale: ActiveAppLocaleCodeSchema,
  now: Schema.DateTimeUtc,
  timeZone: Schema.String,
});

type SchoolTimeRequest = typeof SchoolTimeRequest.Type;

/**
 * The `Intl.DateTimeFormat` options of each shape, named once. A relative day
 * writes its date with the date options, on every day but today and yesterday.
 */
const FORMAT_OPTIONS = {
  date: { dateStyle: "medium" },
  dateTime: { dateStyle: "medium", timeStyle: "short" },
  relativeDay: { dateStyle: "medium" },
  time: { timeStyle: "short" },
} satisfies Record<SchoolTimeFormat, Intl.DateTimeFormatOptions>;

/**
 * A school's time zone is not an IANA name that the platform knows, or it is a
 * fixed offset such as `+07:00`, which is not an IANA name.
 */
export class SchoolTimeZoneError extends Schema.TaggedError<SchoolTimeZoneError>()(
  "SchoolTimeZoneError",
  { timeZone: Schema.String }
) {}

/**
 * Writes one instant in the time zone of a school and in the locale of the
 * reader, in one of the shapes of `SchoolTimeFormat`. The dates and times are
 * the school's own, so the same instant can fall on different days in two
 * schools. The clock is never read here.
 */
export const formatSchoolTime = Effect.fn(
  "internationalization.school.formatTime"
)(function* (request: SchoolTimeRequest) {
  const zone = yield* Effect.fromOption(namedTimeZone(request.timeZone)).pipe(
    Effect.mapError(
      () => new SchoolTimeZoneError({ timeZone: request.timeZone })
    )
  );
  const formatter = new Intl.DateTimeFormat(request.locale, {
    ...FORMAT_OPTIONS[request.format],
    timeZone: DateTime.zoneToString(zone),
  });
  const date = DateTime.formatIntl(formatter)(request.instant);

  if (request.format !== "relativeDay") {
    return date;
  }

  return Option.getOrElse(relativeDay(request, zone), () => date);
});

/**
 * Names the day of the instant `today` or `yesterday` when it falls on the
 * school's current day or on the day before it, in the words of the locale. Any
 * other day has no word. Both days are read on the school's own calendar.
 */
function relativeDay(
  request: SchoolTimeRequest,
  zone: DateTime.TimeZone.Named
) {
  const day = DateTime.formatIsoDate(DateTime.setZone(request.instant, zone));
  const today = DateTime.setZone(request.now, zone);
  const words = new Intl.RelativeTimeFormat(request.locale, {
    numeric: "auto",
  });

  if (day === DateTime.formatIsoDate(today)) {
    return Option.some(words.format(0, "day"));
  }
  if (day === DateTime.formatIsoDate(DateTime.subtract(today, { days: 1 }))) {
    return Option.some(words.format(-1, "day"));
  }
  return Option.none();
}
