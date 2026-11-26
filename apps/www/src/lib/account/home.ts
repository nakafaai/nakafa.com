import type { Ref } from "@confect/core";
import auth from "@repo/backend/confect/_generated/refs/auth";
import contents from "@repo/backend/confect/_generated/refs/contents";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import onboarding from "@repo/backend/confect/_generated/refs/onboarding";
import progress from "@repo/backend/confect/_generated/refs/progress";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Locale } from "@repo/internationalization/src/locale";
import { Array as Arr, Clock, Effect, Option } from "effect";
import { createTranslator } from "use-intl/core";
import { progressSummary } from "@/components/progress/level";
import {
  readAccountOptional,
  resolveAccountClient,
} from "@/lib/account/client";
import type { ScreenSeo } from "@/lib/account/head";
import type { TryoutStart } from "@/lib/account/start";
import type { QueryClient } from "@/lib/convex/read";
import { readQueryOn } from "@/lib/convex/read";
import { readRenderedRouteMessages } from "@/lib/i18n/rendered";

/** The try-out country a learner last picked, or none. */
type TryoutPreference =
  | Ref.Returns<typeof learningPreferences.queries.getCurrentTryout>
  | undefined;

/** The try-out hub catalog, or none when it could not be read. */
type TryoutHub =
  | Ref.Returns<typeof tryouts.queries.catalog.getHubPage>
  | undefined;

/**
 * What a learner who has sat no try-out yet can start (`TryoutStart`): the
 * exams of the country they last picked, or every country from the hub already
 * read in the first batch.
 */
const readTryoutStart = Effect.fn("www.home.readTryoutStart")(function* (
  client: QueryClient,
  locale: Locale,
  preference: TryoutPreference,
  hub: TryoutHub
): Effect.fn.Return<TryoutStart> {
  const country = preference?.country;
  if (country !== undefined) {
    const page = yield* readAccountOptional(
      client,
      tryouts.queries.catalog.getCountryPage,
      { appLocale: locale, publicPath: country.publicPath },
      "home.readOptional"
    );
    if (page) {
      return {
        country: {
          countryCode: page.country.countryCode,
          publicPath: page.country.publicPath,
          title: page.country.title,
        },
        exams: Arr.map(page.exams, (exam) => ({
          examKey: exam.examKey,
          title: exam.title,
        })),
        kind: "country",
      };
    }
  }
  return {
    countries: Arr.map(hub?.countries ?? [], (place) => ({
      countryCode: place.countryCode,
      title: place.title,
    })),
    kind: "countries",
  };
});

/**
 * Reads the signed-in home screen directly in the browser (ADR 0038 D2): the
 * onboarding gate, account name, progress, week, leaderboard, recent try-outs,
 * try-out start, recent lessons, and head metadata go out in one parallel batch
 * over the browser's Convex client with no Worker server function.
 */
export const readHomeScreen = Effect.fn("www.home.read")(function* (
  locale: Locale
) {
  const clientOption = yield* resolveAccountClient();
  if (Option.isNone(clientOption)) {
    return { _tag: "SignedOut" as const };
  }
  const client = clientOption.value;
  const [
    status,
    messages,
    account,
    recentRows,
    growth,
    week,
    leaders,
    attempts,
    preference,
    hub,
    look,
    now,
  ] = yield* Effect.all(
    [
      readQueryOn(client, onboarding.queries.getStatus, {}),
      Effect.promise(() =>
        readRenderedRouteMessages({ locale, namespaces: ["Metadata"] })
      ),
      readAccountOptional(
        client,
        auth.queries.getCurrentUser,
        {},
        "home.readOptional"
      ),
      readAccountOptional(
        client,
        contents.queries.recent.getRecentlyViewed,
        { limit: 3, locale },
        "home.readOptional"
      ),
      readAccountOptional(
        client,
        progress.queries.growth,
        {},
        "home.readOptional"
      ),
      readAccountOptional(
        client,
        progress.queries.week,
        {},
        "home.readOptional"
      ),
      readAccountOptional(
        client,
        progress.queries.leaders,
        {},
        "home.readOptional"
      ),
      readAccountOptional(
        client,
        tryouts.queries.history.recent,
        { locale },
        "home.readOptional"
      ),
      readAccountOptional(
        client,
        learningPreferences.queries.getCurrentTryout,
        { locale },
        "home.readOptional"
      ),
      readAccountOptional(
        client,
        tryouts.queries.catalog.getHubPage,
        { appLocale: locale },
        "home.readOptional"
      ),
      Effect.promise(() => import("@/components/home/look")),
      Clock.currentTimeMillis,
    ],
    { concurrency: "unbounded" }
  );

  if (!status.isAuthenticated) {
    return { _tag: "SignedOut" as const };
  }
  if (status.isRequired) {
    return { _tag: "Onboarding" as const };
  }

  const t = createTranslator({
    locale,
    messages,
    namespace: "Metadata",
  });
  const seo: ScreenSeo = {
    canonicalPath: `/${locale}`,
    description: t("description"),
    indexable: false,
    locale,
    title: t("title"),
  };
  const recent = recentRows ?? [];
  const sat = attempts ?? [];
  const start =
    sat.length === 0
      ? yield* readTryoutStart(client, locale, preference, hub)
      : null;

  return {
    _tag: "Ready" as const,
    screen: {
      attempts: sat,
      growth: progressSummary(growth),
      leaders: leaders ?? [],
      name: Option.getOrUndefined(
        Option.map(Option.fromNullishOr(account), (user) => user.appUser.name)
      ),
      now,
      recent,
      recentLooks: look.getMaterialLooks(recent),
      seo,
      start,
      username: account?.appUser.username,
      week: week ?? undefined,
    },
  };
});
