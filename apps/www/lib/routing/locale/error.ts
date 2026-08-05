import type { routing } from "@repo/internationalization/src/routing";
import { Data } from "effect";

type Locale = (typeof routing.locales)[number];

/** Raised when a localized route exists but has no target-locale projection. */
export class MissingLocalizedRouteProjectionError extends Data.TaggedError(
  "MissingLocalizedRouteProjectionError"
)<{
  locale: Locale;
  publicPath: string;
}> {}
