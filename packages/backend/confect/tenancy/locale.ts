import { namedTimeZone } from "@repo/utilities/timezone";
import { Array as Arr, Option, Schema } from "effect";

/**
 * A contract currency: three uppercase letters, as ISO 4217 writes them. This
 * is the rule a stored tenant keeps for good, because Confect decodes stored
 * documents and a browser decodes what a query returns.
 */
export const Currency = Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/u));

/**
 * A currency code that an organisation may be given: a stored `Currency` that
 * the platform's own list of currencies also names, so a mistyped code is
 * refused where it is written.
 */
export const NewCurrency = Currency.check(
  Schema.makeFilter(
    (code) =>
      Arr.contains(Intl.supportedValuesOf("currency"), code) ||
      "This is not a currency code."
  )
);

/**
 * The time zone of one school, written as the IANA identifier the platform
 * resolves, such as `Asia/Jakarta`. A stored value keeps only the rule that
 * never changes, so a zone the engine of a later browser does not know yet
 * cannot make a school unreadable.
 */
export const TimeZone = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(1),
  Schema.isMaxLength(64)
);

/**
 * A time zone that a school may be given: an IANA identifier that the platform
 * knows as a named zone. A fixed offset such as `+07:00` is not an IANA zone,
 * so it is refused.
 */
export const NewTimeZone = TimeZone.check(
  Schema.makeFilter(
    (id) => Option.isSome(namedTimeZone(id)) || "This is not an IANA time zone."
  )
);
