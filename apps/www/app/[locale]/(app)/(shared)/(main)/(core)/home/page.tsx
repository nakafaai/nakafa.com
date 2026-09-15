import { api } from "@repo/backend/convex/_generated/api";
import { redirect } from "@repo/internationalization/src/navigation";
import type { PublicAppLocale } from "@repo/internationalization/src/routing";
import type { Preloaded } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HomeContinueLearning } from "@/components/home/continue-learning";
import { HomeExplore } from "@/components/home/explore";
import { HomeHeader } from "@/components/home/header";
import { HomeTrending } from "@/components/home/trending";
import { HomeUserProvider } from "@/components/home/user";
import { scheduleCurrentServerExceptionCapture } from "@/lib/analytics/server";
import { fetchAuthQuery, getToken, preloadAuthQuery } from "@/lib/auth/server";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { readOnboardingStatus } from "@/lib/onboarding/server";

type HomeRecentRows = FunctionReturnType<
  typeof api.contents.queries.recent.getRecentlyViewed
>;

/**
 * Personalized values the route resolves with its own request credential.
 *
 * A failed preload only drops the request-time snapshot; the client paths keep
 * the greeting and history reactive instead of failing the page.
 */
interface HomeSeed {
  readonly recentRows: HomeRecentRows;
  readonly user: Preloaded<typeof api.auth.queries.getCurrentUser>;
}

/** Expected failure when the route cannot resolve the signed-in home feed. */
class HomePreloadError extends Schema.TaggedError<HomePreloadError>()(
  "HomePreloadError",
  { cause: Schema.Unknown }
) {}

/** Routes authenticated users through canonical learning selection. */
export default function Page(props: PageProps<"/[locale]/home">) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedHome params={props.params} />
    </Suspense>
  );
}

/** Resolves request auth and learning state inside the route stream. */
async function AuthenticatedHome({
  params,
}: {
  params: PageProps<"/[locale]/home">["params"];
}) {
  const [{ locale: rawLocale }, token] = await Promise.all([
    params,
    getToken(),
  ]);
  const locale = getLocaleOrThrow(rawLocale);

  if (!isActiveLocale(locale)) {
    notFound();
  }

  if (!token) {
    redirect({ href: "/auth", locale });
    return null;
  }

  const onboardingStatus = await Effect.runPromise(readOnboardingStatus(token));
  if (!onboardingStatus.isAuthenticated) {
    redirect({ href: "/auth", locale });
    return null;
  }
  if (onboardingStatus.isRequired) {
    redirect({ href: "/onboarding", locale });
    return null;
  }

  const seed = await Effect.runPromise(
    Effect.all({
      recentRows: Effect.tryPromise({
        catch: (cause) => new HomePreloadError({ cause }),
        try: () =>
          fetchAuthQuery(api.contents.queries.recent.getRecentlyViewed, {
            locale,
            limit: 5,
          }),
      }),
      user: Effect.tryPromise({
        catch: (cause) => new HomePreloadError({ cause }),
        try: () => preloadAuthQuery(api.auth.queries.getCurrentUser, {}),
      }),
    }).pipe(
      Effect.catchTag("HomePreloadError", (error) =>
        scheduleCurrentServerExceptionCapture(error.cause, {
          source: "home-preload",
        }).pipe(Effect.as(null))
      )
    )
  );

  return (
    <div className="relative min-h-[calc(100svh-4rem)] lg:min-h-svh">
      <HomeUserProvider currentUser={seed?.user}>
        <Main locale={locale} recentRows={seed?.recentRows} />
      </HomeUserProvider>
    </div>
  );
}

/** Renders the authenticated home feed in the existing Nakafa home order. */
function Main({
  locale,
  recentRows,
}: {
  locale: PublicAppLocale;
  recentRows: HomeSeed["recentRows"] | undefined;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-24">
      <div className="relative flex flex-col gap-12">
        <HomeHeader />

        <HomeExplore />

        <HomeContinueLearning snapshot={recentRows} />

        <Suspense fallback={null}>
          <HomeTrending locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
