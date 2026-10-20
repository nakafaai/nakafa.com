import { LocaleSchema } from "@repo/internationalization/src/locale";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { createServerFn } from "@tanstack/react-start";
import { appendResponseHeader, getRequest } from "@tanstack/react-start/server";
import { Effect, Option, Schema } from "effect";
import {
  getPostAuthDestination,
  getPostAuthSignInHref,
  resolvePostAuthIntent,
  startsSchool,
} from "@/lib/auth/admission";
import { createRequestSession } from "@/lib/auth/session.server";
import { getShellPageNavigation } from "@/lib/content/page/navigation";
import { recordOnboardingAdmission } from "@/lib/onboarding/server";
import { serverHandler } from "@/lib/server/fn";

/** The page where an account opens its own school, which its first sign-in can resume. */
const SCHOOL_START_INTENT_PATH = "/school/new";

const OnboardingInput = Schema.Struct({
  intent: Schema.optionalKey(Schema.UndefinedOr(Schema.String)),
  locale: LocaleSchema,
});

const SchoolStartInput = Schema.Struct({ locale: LocaleSchema });

/** Sends the visitor to another page of the same locale, decided on the server. */
const redirectTo = (href: string) => ({ _tag: "Redirect" as const, href });

/**
 * The Convex token of this request, or none for a visitor. The session read
 * refreshes the session cookies, so its Set-Cookie values reach the browser.
 */
const readRequestToken = Effect.fn("www.entry.readToken")(function* () {
  const readSession = yield* createRequestSession(getRequest());
  const session = yield* readSession;
  yield* Effect.sync(() => {
    for (const cookie of session.setCookies) {
      appendResponseHeader("set-cookie", cookie);
    }
  });
  return session.convexToken;
});

/**
 * The onboarding questionnaire of a signed-in account. A visitor goes to sign
 * in, an account whose questionnaire is done goes to its destination, and an
 * account that starts a school goes there first, as the questionnaire did.
 */
const readOnboardingPage = Effect.fn("www.entry.onboarding")(function* (
  input: typeof OnboardingInput.Type
) {
  const intent = resolvePostAuthIntent(input.intent, input.locale);
  const signInHref = `/${input.locale}${getPostAuthSignInHref(intent)}`;
  const token = yield* readRequestToken();
  if (Option.isNone(token)) {
    return redirectTo(signInHref);
  }
  const status = yield* recordOnboardingAdmission(token.value);
  if (!status.isAuthenticated) {
    return redirectTo(signInHref);
  }
  if (!status.isRequired || startsSchool(intent)) {
    const destination = getPostAuthDestination(intent, input.locale);
    return redirectTo(`/${destination.locale}${destination.href}`);
  }
  return {
    _tag: "Questionnaire" as const,
    intent,
    profile: status.profile,
  };
});

/**
 * The page where anyone opens a Nakafa School. A visitor signs in first, and
 * the page links to the policy pages of its locale.
 */
const readSchoolStartPage = Effect.fn("www.entry.schoolStart")(function* (
  input: typeof SchoolStartInput.Type
) {
  const token = yield* readRequestToken();
  if (Option.isNone(token)) {
    const intent = resolvePostAuthIntent(
      `/${input.locale}${SCHOOL_START_INTENT_PATH}`,
      input.locale
    );
    return redirectTo(`/${input.locale}${getPostAuthSignInHref(intent)}`);
  }
  const pages = yield* Effect.promise(() =>
    getShellPageNavigation(input.locale)
  );
  return {
    _tag: "Start" as const,
    legal: pages
      ? {
          privacy: new URL(
            `/${input.locale}${pages.privacyPolicyHref}`,
            SITE_ORIGIN
          ).href,
          terms: new URL(
            `/${input.locale}${pages.termsOfServiceHref}`,
            SITE_ORIGIN
          ).href,
        }
      : null,
  };
});

/** The handler of the onboarding page: the questionnaire or a redirect for one request. */
export const onboardingPageHandler = serverHandler(readOnboardingPage);

/** The handler of the school start page: the questionnaire or a redirect for one request. */
export const schoolStartPageHandler = serverHandler(readSchoolStartPage);

/** Decides the onboarding page of one request on the server. */
export const readOnboardingPageFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(OnboardingInput))
  .handler(onboardingPageHandler);

/** Decides the school start page of one request on the server. */
export const readSchoolStartPageFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SchoolStartInput))
  .handler(schoolStartPageHandler);
