import {
  decodeLocale,
  type Locale,
} from "@repo/internationalization/src/locale";
import { COMPANY_SOCIAL_PROFILES } from "@repo/seo/company-profiles";
import { Array as Arr, Option } from "effect";

/** One address that moved. A `:locale` in the destination stands for the locale of the request. */
interface MovedAddress {
  readonly destination: string;
  readonly permanent: boolean;
  readonly source: string;
}

/** The answer to a request for an address that moved: its location and its status. */
export interface MovedRedirect {
  readonly location: string;
  readonly status: 307 | 308;
}

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

/** The addresses that moved under a locale. Only these paths redirect: an open `/:locale/settings` would also catch a valid `/user/settings`. */
const LOCALIZED_ADDRESSES: readonly MovedAddress[] = [
  { destination: "/:locale", permanent: true, source: "/about" },
  {
    destination: "/:locale/user/settings",
    permanent: true,
    source: "/settings",
  },
  {
    destination: "/:locale/user/settings",
    permanent: true,
    source: "/user/settings/developers",
  },
  {
    destination: "/:locale/onboarding",
    permanent: true,
    source: "/onboarding/focus",
  },
  {
    destination: "/:locale/onboarding",
    permanent: true,
    source: "/onboarding/role",
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
 * matches the bare table; a path whose first segment is an active locale matches
 * the localized table under that locale.
 */
export function readMovedRedirect(url: URL): Option.Option<MovedRedirect> {
  const bare = Arr.findFirst(
    BARE_ADDRESSES,
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
  const path = `/${rest.join("/")}`;
  return Option.map(
    Arr.findFirst(LOCALIZED_ADDRESSES, ({ source }) => source === path),
    (address) => toRedirect(address, locale.value, url.search)
  );
}
