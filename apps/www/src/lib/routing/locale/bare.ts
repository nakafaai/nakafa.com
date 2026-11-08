import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import { readSpellingLocale } from "@repo/internationalization/src/pathnames";
import { LOCALE_VARY } from "@repo/internationalization/src/redirect";
import { Array as Arr, Option } from "effect";
import { isBareSchoolPage } from "@/lib/routing/locale/address";
import { isBareRoutePath } from "@/lib/routing/rendered";
import { routeRewrite } from "@/lib/routing/rewrite";

/** A first path segment shaped like a locale code, such as `fr` or `EN`. */
const LOCALE_SHAPED_SEGMENT = /^[a-z]{2}$/iu;

/**
 * Whether a request names a bare page address: its path, after the router's
 * input rewrite, names neither a locale nor a Worker route of its own, or it is
 * one of the main host's School pages without a locale. A school host's path
 * becomes its school tree, so it is never bare, and an API route, a discovery
 * file or a server function keeps its own route.
 */
function isBareAddress(url: URL) {
  return (
    isBareRoutePath(url) ||
    isBareSchoolPage(routeRewrite.input({ url }).pathname)
  );
}

/**
 * The redirect of a bare page address, such as `/quran/2?ayah=5`,
 * `/@username/chat` or `/school/pricing`, or none. A first segment that is one
 * locale's public spelling, such as `materi`, names that locale, and the rest of
 * the address is in its slugs, so the address opens there with a 308. Any other
 * address opens in the negotiated locale (the language cookie, then the browser's
 * languages among id, en and de, else Indonesian) with a 307 that varies on them,
 * the query kept. A first segment shaped like a locale code names a locale that
 * Nakafa does not serve, and a last segment with a dot names a file
 * (`/wp-login.php`, `/robots.txt`), so neither names a page and both stay
 * missing. The server entry asks this after the moved addresses.
 */
export function readBareAddress(request: Request): Option.Option<Response> {
  const url = new URL(request.url);
  if (!isBareAddress(url)) {
    return Option.none();
  }
  const segments = Arr.filter(
    url.pathname.split("/"),
    (segment) => segment !== ""
  );
  const isPage =
    Option.exists(
      Arr.head(segments),
      (first) => !LOCALE_SHAPED_SEGMENT.test(first)
    ) && Option.exists(Arr.last(segments), (last) => !last.includes("."));
  if (!isPage) {
    return Option.none();
  }
  const spelled = Option.flatMap(Arr.head(segments), readSpellingLocale);
  if (Option.isSome(spelled)) {
    return Option.some(
      new Response(null, {
        headers: {
          location: `/${spelled.value}${url.pathname}${url.search}`,
        },
        status: 308,
      })
    );
  }
  return Option.some(
    new Response(null, {
      headers: {
        location: `/${negotiateLocale(request.headers)}${url.pathname}${url.search}`,
        vary: LOCALE_VARY,
      },
      status: 307,
    })
  );
}
