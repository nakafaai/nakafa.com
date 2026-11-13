import {
  decodeLocale,
  type Locale,
} from "@repo/internationalization/src/locale";
import { COMPANY_SOCIAL_PROFILES } from "@repo/seo/profiles";
import { Array as Arr, Option, Schema } from "effect";

/** One address that moved. A `:locale` in the destination stands for the locale of the request. */
const MovedAddressSchema = Schema.Struct({
  destination: Schema.String,
  permanent: Schema.Boolean,
  source: Schema.String,
});
type MovedAddress = typeof MovedAddressSchema.Type;

/** The answer to a request for an address that moved: its location and its status. */
const MovedRedirectSchema = Schema.Struct({
  location: Schema.String,
  status: Schema.Literals([307, 308]),
});
type MovedRedirect = typeof MovedRedirectSchema.Type;

/** The addresses that moved without a locale, as the reference site answered them. */
const BARE_ADDRESSES: readonly MovedAddress[] = [
  { destination: "/", permanent: true, source: "/about" },
  { destination: "/sitemap.xml", permanent: true, source: "/sitemap.txt" },
  {
    destination: "/.well-known/agent-skills/index.json",
    permanent: true,
    source: "/.well-known/skills/index.json",
  },
  {
    destination: COMPANY_SOCIAL_PROFILES.discord,
    permanent: false,
    source: "/discord",
  },
  {
    destination: COMPANY_SOCIAL_PROFILES.discord,
    permanent: false,
    source: "/community",
  },
];

/**
 * Retired pages that Search Console still showed with impressions on 13 November
 * 2026, each answered by the live page that took over its job: the old TKA
 * practice index by the TKA try-out, and the old grade 11 subject index by the
 * Kurikulum Merdeka class 11 page. Each one redirects exactly; nothing under it does.
 */
const SHOWN_ADDRESSES: readonly MovedAddress[] = [
  {
    destination: "/id/try-out/indonesia/tka",
    permanent: true,
    source: "/id/latihan/tka",
  },
  {
    destination: "/en/curriculum/merdeka/class-11",
    permanent: true,
    source: "/en/subject/high-school/11",
  },
];

/** The addresses that moved under a locale. Only these paths redirect: an open `/:locale/settings` would also catch a valid `/user/settings`. */
const LOCALIZED_ADDRESSES: readonly MovedAddress[] = [
  { destination: "/:locale", permanent: true, source: "/about" },
  {
    destination: "/:locale/user/settings",
    permanent: true,
    source: "/settings",
  },
];

/** The redirect of one moved address, with its locale filled in and its query kept. */
function toRedirect(
  address: MovedAddress,
  locale: Locale | undefined,
  search: string
): MovedRedirect {
  return {
    location: `${address.destination.replace(":locale", locale ?? "")}${search}`,
    status: address.permanent ? 308 : 307,
  };
}

/**
 * The redirect of an address that the product moved, or none. A bare address
 * or a retired page that search still shows matches its exact path; a path whose
 * first segment is an active locale matches the localized table under that locale.
 */
export function readMovedRedirect(url: URL): Option.Option<MovedRedirect> {
  const bare = Arr.findFirst(
    Arr.appendAll(BARE_ADDRESSES, SHOWN_ADDRESSES),
    ({ source }) => source === url.pathname
  );
  if (Option.isSome(bare)) {
    return Option.some(toRedirect(bare.value, undefined, url.search));
  }
  const [, segment, ...rest] = url.pathname.split("/");
  const locale = decodeLocale(segment);
  if (Option.isNone(locale)) {
    return Option.none();
  }
  const path = `/${Arr.join(rest, "/")}`;
  return Option.map(
    Arr.findFirst(LOCALIZED_ADDRESSES, ({ source }) => source === path),
    (address) => toRedirect(address, locale.value, url.search)
  );
}
