import {
  MATERIAL_CONTEXT_HINT_LENGTH,
  MATERIAL_CONTEXT_QUERY_PARAM,
} from "@repo/contents/route/material/context";
import { splitLocalePathname } from "@repo/internationalization/src/href";
import {
  DEFAULT_LOCALE,
  LocaleSchema,
} from "@repo/internationalization/src/locale";
import { toPublicPath } from "@repo/internationalization/src/rewrite";
import { Array as Arr, Option, Schema } from "effect";

/** The router location that a page reads: its pathname in the router's spelling, and its search string. */
export const RouterPageLocation = Schema.Struct({
  pathname: Schema.String,
  searchStr: Schema.String,
});
export type RouterPageLocation = typeof RouterPageLocation.Type;

/** The page that a router location shows, as a Nina turn names it. */
const RouterPage = Schema.Struct({
  locale: LocaleSchema,
  /** The public path of the page without its locale, such as `/articles/education`. */
  slug: Schema.String,
  /** The material context hint of the link, when it is one the server takes. */
  materialContextHint: Schema.optionalKey(Schema.String),
});

/**
 * Reads the locale, the public path and the material context hint of a router
 * location. The hint is left out when it is longer than the server accepts,
 * as the material page leaves it out.
 */
export function readRouterPage(
  location: RouterPageLocation
): typeof RouterPage.Type {
  const { locale, publicSegments } = splitLocalePathname(
    toPublicPath(location.pathname)
  );
  const hint = Option.fromNullishOr(
    new URLSearchParams(location.searchStr).get(MATERIAL_CONTEXT_QUERY_PARAM)
  );
  const slug = Arr.join(publicSegments, "/");
  return {
    locale: locale ?? DEFAULT_LOCALE,
    slug: slug === "" ? "/" : `/${slug}`,
    ...Option.match(hint, {
      onNone: () => ({}),
      onSome: (value) =>
        value.length <= MATERIAL_CONTEXT_HINT_LENGTH
          ? { materialContextHint: value }
          : {},
    }),
  };
}
