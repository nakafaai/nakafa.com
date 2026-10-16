import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { Array as Arr } from "effect";
import { hasLocale } from "next-intl";

/** The segment of the internal route tree that holds every school page. */
export const SCHOOL_SEGMENT = "school";

/**
 * Whether a path points into the school tree of the internal routes, with or
 * without a locale in front. Only a school host may reach that tree, so every
 * other host answers such a path with 404, and `nakafa.com/id/school/...` stays
 * gone.
 */
export function isSchoolTreePath(pathname: string) {
  const [first, second] = Arr.filter(pathname.split("/"), Boolean);
  if (first === SCHOOL_SEGMENT) {
    return true;
  }
  return hasLocale(APP_LOCALE_CODES, first) && second === SCHOOL_SEGMENT;
}
