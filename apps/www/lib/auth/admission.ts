import { routing } from "@repo/internationalization/src/routing";
import { Option, Schema } from "effect";
import { hasLocale } from "next-intl";

const URL_PARSE_BASE = "https://internal.invalid";
const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;
const MAX_INTENT_LENGTH = 4096;
const AUTH_PATH = "/auth";
const CONTINUATION_PATH = "/auth/continue";
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
    pathname === "/_next" ||
    pathname.startsWith("/_next/") ||
    pathname === "/_not-found" ||
    pathname === "/api" ||
    pathname.startsWith("/api/")
  );
}

function splitLocalizedPathname(pathname: string, fallbackLocale: string) {
  const firstSegment = pathname.slice(1).split("/", 1)[0];
  if (!hasLocale(routing.locales, firstSegment)) {
    const locale = hasLocale(routing.locales, fallbackLocale)
      ? fallbackLocale
      : routing.defaultLocale;
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
  const parsed = parseSafePostAuthSource(source, routing.defaultLocale);
  if (!parsed) {
    return false;
  }

  const firstSegment = parsed.url.pathname.slice(1).split("/", 1)[0];
  if (!hasLocale(routing.locales, firstSegment)) {
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

export type PostAuthIntent = Schema.Schema.Type<typeof PostAuthIntentSchema>;

const AppLocaleSchema = Schema.Literals(routing.locales);

export const PostAuthIntentResolutionSchema = Schema.Union([
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

export type PostAuthIntentResolution = Schema.Schema.Type<
  typeof PostAuthIntentResolutionSchema
>;

export interface PostAuthDestination {
  readonly href: string;
  readonly locale: (typeof routing.locales)[number];
}

const decodeString = Schema.decodeUnknownOption(Schema.String);

/** Resolves untrusted URL state into an explicit post-auth intent decision. */
export function resolvePostAuthIntent(
  rawIntent: unknown,
  rawLocale: string = routing.defaultLocale
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

  const normalized = `/${parsed.locale}${parsed.pathname}${parsed.url.search}${parsed.url.hash}`;
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

/** Builds the sole Better Auth callback path for the current locale. */
export function getPostAuthContinuationHref(
  rawIntent: unknown,
  rawLocale: string
) {
  const locale = hasLocale(routing.locales, rawLocale)
    ? rawLocale
    : routing.defaultLocale;
  const continuation = withIntent(
    CONTINUATION_PATH,
    resolvePostAuthIntent(rawIntent, locale)
  );
  return `/${locale}${continuation}`;
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
  const locale = hasLocale(routing.locales, rawLocale)
    ? rawLocale
    : routing.defaultLocale;
  const landing = withIntent(
    PROVIDER_ERROR_PATH,
    resolvePostAuthIntent(rawIntent, locale)
  );
  return `/${locale}${landing}`;
}

/** Builds a clean generic retry after provider diagnostics are discarded. */
export function getPostAuthProviderRetryHref(
  resolution: PostAuthIntentResolution
) {
  const signInUrl = new URL(getPostAuthSignInHref(resolution), URL_PARSE_BASE);
  signInUrl.searchParams.set(PROVIDER_ERROR_PARAM, PROVIDER_ERROR_VALUE);
  return `${signInUrl.pathname}${signInUrl.search}`;
}

/** Returns whether a sanitized retry represents a social-provider failure. */
export function isPostAuthProviderError(rawError: unknown) {
  return rawError === PROVIDER_ERROR_VALUE;
}

/** Returns onboarding while preserving only one validated continuation intent. */
export function getPostAuthOnboardingHref(
  resolution: PostAuthIntentResolution
) {
  return withIntent(ONBOARDING_PATH, resolution);
}

/** Returns the requested localized destination, or current-locale Home. */
export function getPostAuthDestination(
  resolution: PostAuthIntentResolution,
  fallbackLocale: string
): PostAuthDestination {
  if (resolution.kind === "none") {
    return {
      href: HOME_PATH,
      locale: hasLocale(routing.locales, fallbackLocale)
        ? fallbackLocale
        : routing.defaultLocale,
    };
  }

  const url = new URL(resolution.intent, URL_PARSE_BASE);
  const localized = splitLocalizedPathname(url.pathname, resolution.locale);
  return {
    href: `${localized.pathname}${url.search}${url.hash}`,
    locale: resolution.locale,
  };
}
