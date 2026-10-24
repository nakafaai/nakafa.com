import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
} from "@repo/internationalization/src/locale";

import { Option, Schema } from "effect";
import { hasLocale } from "use-intl";
import type { LinkTarget } from "@/lib/routing/link";
import { withoutShareToken } from "@/lib/share/fragment";

const URL_PARSE_BASE = "https://internal.invalid";
const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;
const MAX_INTENT_LENGTH = 4096;
const AUTH_PATH = "/auth";
const PROVIDER_ERROR_PATH = "/auth/error";
const HOME_PATH = "/home";
const INTENT_PARAM = "intent";
const ONBOARDING_PATH = "/onboarding";
const REDIRECT_PARAM = "redirect";
const PROVIDER_ERROR_PARAM = "error";
const PROVIDER_ERROR_VALUE = "oauth";

/** Returns whether untrusted text has the shape of one internal href. */
function hasSafeInternalShape(source: string) {
  return (
    !(CONTROL_CHARACTER_PATTERN.test(source) || source.includes("\\")) &&
    source.length <= MAX_INTENT_LENGTH &&
    source.startsWith("/") &&
    !source.startsWith("//")
  );
}

/** Returns whether a normalized path would recurse through an entry route. */
function isEntryPath(pathname: string) {
  return (
    pathname === AUTH_PATH ||
    pathname.startsWith(`${AUTH_PATH}/`) ||
    pathname === ONBOARDING_PATH ||
    pathname.startsWith(`${ONBOARDING_PATH}/`)
  );
}

/** Returns whether a pathname belongs to framework or non-page routing. */
function isReservedPath(pathname: string) {
  return (
    pathname === "/assets" ||
    pathname.startsWith("/assets/") ||
    pathname === "/_serverFn" ||
    pathname.startsWith("/_serverFn/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/")
  );
}

function splitLocalizedPathname(pathname: string, fallbackLocale: string) {
  const firstSegment = pathname.slice(1).split("/", 1)[0];
  if (!hasLocale(LOCALES, firstSegment)) {
    const locale = hasLocale(LOCALES, fallbackLocale)
      ? fallbackLocale
      : DEFAULT_LOCALE;
    return { locale, pathname };
  }

  const unlocalized = pathname.slice(firstSegment.length + 1);
  return {
    locale: firstSegment,
    pathname: unlocalized === "" ? "/" : unlocalized,
  };
}

/** Parses one internal source and rejects unsafe URL-normalized pathnames. */
function parseSafePostAuthSource(source: string, fallbackLocale: string) {
  if (!hasSafeInternalShape(source)) {
    return null;
  }

  const url = new URL(source, URL_PARSE_BASE);
  const localized = splitLocalizedPathname(url.pathname, fallbackLocale);
  if (!hasSafeInternalShape(localized.pathname)) {
    return null;
  }

  return { ...localized, url };
}

/** Returns whether a normalized intent is one canonical localized app href. */
function isCanonicalPostAuthIntent(source: string) {
  const parsed = parseSafePostAuthSource(source, DEFAULT_LOCALE);
  if (!parsed) {
    return false;
  }

  const firstSegment = parsed.url.pathname.slice(1).split("/", 1)[0];
  if (!hasLocale(LOCALES, firstSegment)) {
    return false;
  }

  return (
    parsed.pathname !== "/" &&
    parsed.pathname !== HOME_PATH &&
    !isEntryPath(parsed.pathname) &&
    !isReservedPath(parsed.pathname)
  );
}

/** Runtime contract for one localized internal route resumed after auth. */
export const PostAuthIntentSchema = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter(isCanonicalPostAuthIntent, {
      message: "Expected a localized internal post-auth route.",
    })
  ),
  Schema.brand("@Nakafa/PostAuthIntent")
);

const AppLocaleSchema = Schema.Literals(LOCALES);

const PostAuthIntentResolutionSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("none"),
    reason: Schema.Literals([
      "absent",
      "default-route",
      "entry-route",
      "invalid",
      "marketing-root",
    ]),
  }),
  Schema.Struct({
    intent: PostAuthIntentSchema,
    kind: Schema.Literal("resume"),
    locale: AppLocaleSchema,
  }),
]);

export type PostAuthIntentResolution =
  typeof PostAuthIntentResolutionSchema.Type;

const PostAuthDestinationSchema = Schema.Struct({
  href: Schema.String,
  locale: AppLocaleSchema,
});

type PostAuthDestination = typeof PostAuthDestinationSchema.Type;

const decodeString = Schema.decodeUnknownOption(Schema.String);

/**
 * Resolves untrusted URL state into an explicit post-auth intent decision.
 *
 * An intent travels in the query string of the auth and onboarding routes, so
 * it never carries a share token: the token is a credential that a fragment
 * keeps away from every server. A visitor who signs in from a shared chat comes
 * back to the chat by id and opens the link again.
 */
export function resolvePostAuthIntent(
  rawIntent: unknown,
  rawLocale: string = DEFAULT_LOCALE
): PostAuthIntentResolution {
  if (rawIntent === undefined || rawIntent === null || rawIntent === "") {
    return { kind: "none", reason: "absent" };
  }

  const source = decodeString(rawIntent);
  if (Option.isNone(source)) {
    return { kind: "none", reason: "invalid" };
  }

  const parsed = parseSafePostAuthSource(source.value, rawLocale);
  if (!parsed) {
    return { kind: "none", reason: "invalid" };
  }
  if (parsed.pathname === "/") {
    return { kind: "none", reason: "marketing-root" };
  }
  if (parsed.pathname === HOME_PATH) {
    return { kind: "none", reason: "default-route" };
  }
  if (isEntryPath(parsed.pathname)) {
    return { kind: "none", reason: "entry-route" };
  }
  if (isReservedPath(parsed.pathname)) {
    return { kind: "none", reason: "invalid" };
  }

  const normalized = `/${parsed.locale}${parsed.pathname}${parsed.url.search}${withoutShareToken(parsed.url.hash)}`;
  const intent = PostAuthIntentSchema.makeOption(normalized);
  if (Option.isNone(intent)) {
    return { kind: "none", reason: "invalid" };
  }

  return {
    intent: intent.value,
    kind: "resume",
    locale: parsed.locale,
  };
}

/** Appends one validated intent to an internal entry route. */
function withIntent(pathname: string, resolution: PostAuthIntentResolution) {
  if (resolution.kind === "none") {
    return pathname;
  }

  return `${pathname}?${new URLSearchParams({
    [INTENT_PARAM]: resolution.intent,
  })}`;
}

/** Builds the authoritative onboarding callback path for the current locale. */
export function getPostAuthOnboardingHref(
  rawIntent: unknown,
  rawLocale: string
) {
  const locale = hasLocale(LOCALES, rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const onboarding = withIntent(
    ONBOARDING_PATH,
    resolvePostAuthIntent(rawIntent, locale)
  );
  return `/${locale}${onboarding}`;
}

/** Rebuilds a trusted browser location into one exact intent source. */
export function getPostAuthIntentSource(
  pathname: string,
  search: string,
  hash = ""
) {
  const query = search === "" || search.startsWith("?") ? search : `?${search}`;
  const fragment = hash === "" || hash.startsWith("#") ? hash : `#${hash}`;
  return `${pathname}${query}${fragment}`;
}

/** Builds auth entry from a browser-location snapshot without reading globals. */
export function getPostAuthSignInHrefForLocation(
  location: {
    readonly hash: string;
    readonly pathname: string;
    readonly search: string;
  },
  rawLocale: string
) {
  const source = getPostAuthIntentSource(
    location.pathname,
    location.search,
    location.hash
  );
  return getPostAuthSignInHref(resolvePostAuthIntent(source, rawLocale));
}

/**
 * The sign-in route of one locale, resuming the intent that a browser source
 * (path, search and hash) names. A source that names no intent opens the bare route.
 */
export function getPostAuthSignInTarget(
  source: string,
  locale: Locale
): LinkTarget {
  const resolution = resolvePostAuthIntent(source, locale);
  if (resolution.kind === "none") {
    return { params: { locale }, to: "/$locale/auth" } satisfies LinkTarget;
  }
  return {
    params: { locale },
    search: { [REDIRECT_PARAM]: resolution.intent },
    to: "/$locale/auth",
  } satisfies LinkTarget;
}

/** Returns the localized-auth input needed when continuation has no session. */
export function getPostAuthSignInHref(resolution: PostAuthIntentResolution) {
  if (resolution.kind === "none") {
    return AUTH_PATH;
  }

  return `${AUTH_PATH}?${new URLSearchParams({
    [REDIRECT_PARAM]: resolution.intent,
  })}`;
}

/** Builds the same-origin landing that contains a provider's raw failure. */
export function getPostAuthProviderErrorHref(
  rawIntent: unknown,
  rawLocale: string
) {
  const locale = hasLocale(LOCALES, rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const landing = withIntent(
    PROVIDER_ERROR_PATH,
    resolvePostAuthIntent(rawIntent, locale)
  );
  return `/${locale}${landing}`;
}

/**
 * The typed search of the generic retry on the sign-in page, after provider
 * diagnostics are discarded. The route hands it to its typed redirect, so the
 * search keys stay the sign-in route's own schema.
 */
export function getPostAuthProviderRetrySearch(
  resolution: PostAuthIntentResolution
) {
  if (resolution.kind === "none") {
    return { [PROVIDER_ERROR_PARAM]: PROVIDER_ERROR_VALUE };
  }
  return {
    [PROVIDER_ERROR_PARAM]: PROVIDER_ERROR_VALUE,
    [REDIRECT_PARAM]: resolution.intent,
  };
}

/** Returns whether a sanitized retry represents a social-provider failure. */
export function isPostAuthProviderError(rawError: unknown) {
  return rawError === PROVIDER_ERROR_VALUE;
}

/** The page where an account opens its own school, without its locale. */
const SCHOOL_START_PATH = "/school/new";

/**
 * Whether the intent resumes on the page where an account opens its own school.
 * That questionnaire is the account's first run, so the learner questionnaire
 * waits until the account first uses Nakafa for itself (K42).
 */
export function startsSchool(resolution: PostAuthIntentResolution) {
  if (resolution.kind === "none") {
    return false;
  }
  const url = new URL(resolution.intent, URL_PARSE_BASE);
  return (
    splitLocalizedPathname(url.pathname, resolution.locale).pathname ===
    SCHOOL_START_PATH
  );
}

/** Returns the requested localized destination, or current-locale Home. */
export function getPostAuthDestination(
  resolution: PostAuthIntentResolution,
  fallbackLocale: string
): PostAuthDestination {
  if (resolution.kind === "none") {
    return {
      href: HOME_PATH,
      locale: hasLocale(LOCALES, fallbackLocale)
        ? fallbackLocale
        : DEFAULT_LOCALE,
    };
  }

  const url = new URL(resolution.intent, URL_PARSE_BASE);
  const localized = splitLocalizedPathname(url.pathname, resolution.locale);
  return {
    href: `${localized.pathname}${url.search}${url.hash}`,
    locale: resolution.locale,
  };
}
