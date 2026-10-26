import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import {
  formatSchoolTime,
  type SchoolTimeFormat,
} from "@repo/internationalization/src/school/time";
import { DateTime, Effect, Option, Schema } from "effect";

/** One moment to write on a school's clock: its instant, the reader's language, and the school's zone. */
const ClockRequest = Schema.Struct({
  at: Schema.Finite,
  locale: Schema.String,
  timeZone: Schema.String,
});

/** The request of one clock text, as `ClockRequest` declares it. */
type ClockRequest = typeof ClockRequest.Type;

/**
 * Writes one moment in one shape, as the school's own clock shows it, in the reader's language.
 * It writes nothing when the language is not an active one or the time zone is not a known one,
 * so a school row never shows a time in another zone.
 */
function writeSchoolTime(
  format: SchoolTimeFormat,
  request: ClockRequest
): string | undefined {
  const locale = Option.getOrUndefined(
    Schema.decodeUnknownOption(ActiveAppLocaleCodeSchema)(request.locale)
  );
  if (locale === undefined) {
    return undefined;
  }
  return Option.getOrUndefined(
    Effect.runSync(
      Effect.option(
        formatSchoolTime({
          format,
          instant: DateTime.makeUnsafe(request.at),
          locale,
          now: DateTime.nowUnsafe(),
          timeZone: request.timeZone,
        })
      )
    )
  );
}

/** Writes one moment as a date and a time on the school's clock, in the reader's language. */
export function schoolDateTimeText(request: ClockRequest) {
  return writeSchoolTime("dateTime", request);
}

/**
 * Writes one moment as its day, its month and its time on the school's clock, in the reader's language,
 * without the year: a short name for a moment of the next weeks that a phone row has room for.
 */
export function schoolDayTimeText(request: ClockRequest) {
  return writeSchoolTime("dayTime", request);
}
