import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Option } from "effect";
import { hasLocale } from "next-intl";

/** The segment of the internal route tree that holds every school page. */
export const SCHOOL_SEGMENT = "school";

/** Decodes one path segment as next-intl does, and yields none when the segment does not decode. */
const decodeSegment = Option.liftThrowable(decodeURI);

/**
 * The segment at one index of a path, decoded the way next-intl decodes the
 * path before it routes it. A segment that does not decode names no page.
 */
function readSegment(segments: readonly string[], index: number) {
  return Arr.get(segments, index).pipe(Option.flatMap(decodeSegment));
}

/**
 * Whether a path points into the school tree of the internal routes, with or
 * without a locale in front. Only a school host may reach that tree, so every
 * other host answers such a path with 404, and `nakafa.com/id/school/...` stays
 * gone. The segments are decoded first, because next-intl decodes the path
 * before it rewrites it: `/id/%73chool/harapan` reaches the same page as
 * `/id/school/harapan`.
 */
export function isSchoolTreePath(pathname: string) {
  const segments = Arr.filter(pathname.split("/"), Boolean);
  const first = readSegment(segments, 0);
  if (Option.contains(first, SCHOOL_SEGMENT)) {
    return true;
  }
  const startsWithLocale = Option.exists(first, (segment) =>
    hasLocale(APP_LOCALE_CODES, segment)
  );
  return (
    startsWithLocale &&
    Option.contains(readSegment(segments, 1), SCHOOL_SEGMENT)
  );
}
