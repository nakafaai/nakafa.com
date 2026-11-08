import {
  type AppLocaleCode,
  AppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Schema } from "effect";
import { readPublishedTryoutLocalizedPath } from "@/lib/content/tryout/path";

export const TRYOUT_ROOT = "try-out";
export const SNBT_ROUTE = "snbt";
export const SNBT_ROUTE_PATH = `${TRYOUT_ROOT}/${SNBT_ROUTE}`;
/** Canonical SNBT exam path. Every app locale localizes it through the signed catalog. */
export const SNBT_EXAM_PATH = "try-out/indonesia/snbt";
/** Locale whose signed paths anchor the localized successors of retired SNBT URLs. */
export const SOURCE_APP_LOCALE = "en";
export const decodeAppLocale = Schema.decodeUnknownOption(AppLocaleCodeSchema);

/** Splits one public pathname into its non-empty segments. */
export function readPathSegments(pathname: string) {
  return Arr.filter(pathname.split("/"), (segment) => segment !== "");
}

/** Reads whether the active signed catalog serves one exact route in its own locale. */
export function readActiveTryoutPath(appLocale: AppLocaleCode, path: string) {
  return readPublishedTryoutLocalizedPath({
    currentAppLocale: appLocale,
    publicPath: path,
    targetAppLocale: appLocale,
  });
}


