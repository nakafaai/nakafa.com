import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { formatSchoolTime } from "@repo/internationalization/src/school/time";
import { DateTime, Effect, Option, Schema } from "effect";

/**
 * Writes one moment as the school's own clock shows it, in the reader's language.
 * It writes nothing when the language is not an active one or the time zone is not
 * a known one, so a school row never shows a time in another zone.
 */
export function schoolDateTimeText(request: {
  readonly at: number;
  readonly locale: string;
  readonly timeZone: string;
}): string | undefined {
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
          format: "dateTime",
          instant: DateTime.makeUnsafe(request.at),
          locale,
          now: DateTime.nowUnsafe(),
          timeZone: request.timeZone,
        })
      )
    )
  );
}
