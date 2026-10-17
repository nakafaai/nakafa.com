import { DateTime, Option } from "effect";

/**
 * An IANA zone name never starts with a sign, but the platform takes a fixed
 * offset as a zone too, in forms such as `+07:00`, `+0700`, and `-07`.
 */
const OFFSET_SIGN = /^[+-]/u;

/**
 * The named zone of an IANA time zone name such as `Asia/Jakarta`, or none when
 * the platform does not know the name. The platform keeps `GMT`, `GMT0`, `GMT+0`,
 * and `GMT-0` as named zones. Effect's `zoneFromString` reads a name that starts
 * with `GMT` as an offset and finds none, so the platform answers here instead.
 * A name that starts with a sign is an offset, so it is refused.
 */
export function namedTimeZone(
  id: string
): Option.Option<DateTime.TimeZone.Named> {
  if (OFFSET_SIGN.test(id)) {
    return Option.none();
  }
  return DateTime.zoneMakeNamed(id);
}
