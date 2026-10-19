import { DEFAULT_LOCALE, LOCALES } from "@repo/internationalization/src/locale";
import { toPublicPath } from "@repo/internationalization/src/rewrite";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Schema } from "effect";

/** One `hreflang` link of a page: a public locale, or `x-default` for the default locale's page. */
const Alternate = Schema.Struct({
  hreflang: Schema.Literals([...LOCALES, "x-default"]),
  href: Schema.String,
});

type Alternate = typeof Alternate.Type;

/** The same route in another locale: its locale segment is replaced, and the rest of the path is kept. */
function withLocale(path: string, locale: string) {
  const segments = path.split("/");
  return Arr.join(
    [...Arr.take(segments, 1), locale, ...Arr.drop(segments, 2)],
    "/"
  );
}

/** The absolute address of a canonical path, written in its public spelling. */
function hrefOf(path: string) {
  return new URL(toPublicPath(path), SITE_ORIGIN).href;
}

/**
 * The alternate links of one page in every public locale, plus `x-default`,
 * which is the page of the default locale. The path names the page in any
 * locale with its canonical segments, such as `/en/curricula`, and each
 * locale's link is that page in its own spelling, such as `/de/lehrplaene`.
 */
export function readAlternates(path: string): readonly Alternate[] {
  const alternates = Arr.map(LOCALES, (locale) =>
    Alternate.make({
      hreflang: locale,
      href: hrefOf(withLocale(path, locale)),
    })
  );
  return [
    ...alternates,
    Alternate.make({
      hreflang: "x-default",
      href: hrefOf(withLocale(path, DEFAULT_LOCALE)),
    }),
  ];
}
