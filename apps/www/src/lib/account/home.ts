import type { Ref } from "@confect/core";
import auth from "@repo/backend/confect/_generated/refs/auth";
import contents from "@repo/backend/confect/_generated/refs/contents";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import onboarding from "@repo/backend/confect/_generated/refs/onboarding";
import progress from "@repo/backend/confect/_generated/refs/progress";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Locale } from "@repo/internationalization/src/locale";
import { ConvexHttpClient } from "convex/browser";
import { Array as Arr, Clock, Effect, Option } from "effect";
import { createTranslator } from "use-intl/core";
import { progressSummary } from "@/components/progress/level";
import { clientEnv } from "@/env.public";
import type { ScreenSeo } from "@/lib/account/head";
import type { TryoutStart } from "@/lib/account/start";
import { reportClientException } from "@/lib/analytics/client";
import { readBrowserSession } from "@/lib/auth/token";
import { readMadeClient } from "@/lib/convex/client";
import { failAtGateway } from "@/lib/convex/http";
import type { QueryClient } from "@/lib/convex/read";
import { readQueryOn } from "@/lib/convex/read";
import { readRenderedRouteMessages } from "@/lib/i18n/rendered";

/** Whether a failed read is a transport or decoding failure rather than a typed query refusal. */
const isQueryReadFailed = (error: { readonly _tag: string }): boolean =>
  error._tag === "QueryReadFailed";

/**
 * Reads one optional home section. A typed refusal leaves the section empty,
 * and an unexpected read failure is reported and leaves the section empty so
 * one failing widget never blocks the whole home screen.
 */
const readOptional = Effect.fn("www.home.readOptional")(function* <
  Query extends Ref.AnyPublicQuery,
>(client: QueryClient, ref: Query, args: Ref.Args<Query>) {
  return yield* readQueryOn(client, ref, args).pipe(
    Effect.catch((error) =>
      isQueryReadFailed(error)
        ? reportClientException(error, {
            operation: ref.convexFunctionName,
            source: "home.readOptional",
          }).pipe(Effect.as(undefined))
        : Effect.undefined
    )
  );
});

/**
 * Resolves the Convex client for one home screen read. On SPA navigation inside
 * the app shell, the page's authenticated WebSocket client is already live, so
 * every query runs over that open socket with no Worker request and no token
 * refresh (ADR 0038 D2). On a cold page load before the shell mounts, the
 * browser refreshes its token once and reads Convex directly over HTTP.
 */
const resolveHomeClient = Effect.fn("www.home.resolveClient")(function* (
  origin: string
) {
  const live = readMadeClient();
  if (Option.isSome(live)) {
    return Option.some<QueryClient>(live.value);
  }
  const session = yield* readBrowserSession(origin);
  if (session === null) {
    return Option.none<QueryClient>();
  }
  const http = new ConvexHttpClient(clientEnv.VITE_CONVEX_URL, {
    fetch: failAtGateway(fetch),
  });
  http.setAuth(session.accessToken);
  return Option.some<QueryClient>(http);
});

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
    const page = yield* readOptional(
      client,
      tryouts.queries.catalog.getCountryPage,
      { appLocale: locale, publicPath: country.publicPath }
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
  locale: Locale,
  origin: string
) {
  const clientOption = yield* resolveHomeClient(origin);
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
      readOptional(client, auth.queries.getCurrentUser, {}),
      readOptional(client, contents.queries.recent.getRecentlyViewed, {
        limit: 3,
        locale,
      }),
      readOptional(client, progress.queries.growth, {}),
      readOptional(client, progress.queries.week, {}),
      readOptional(client, progress.queries.leaders, {}),
      readOptional(client, tryouts.queries.history.recent, { locale }),
      readOptional(client, learningPreferences.queries.getCurrentTryout, {
        locale,
      }),
      readOptional(client, tryouts.queries.catalog.getHubPage, {
        appLocale: locale,
      }),
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
