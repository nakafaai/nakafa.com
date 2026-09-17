import { api } from "@repo/backend/convex/_generated/api";
import { redirect } from "@repo/internationalization/src/navigation";
import type { PublicAppLocale } from "@repo/internationalization/src/routing";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HomeContinueLearning } from "@/components/home/continue-learning";
import { HomeExplore } from "@/components/home/explore";
import { HomeHeader } from "@/components/home/header";
import { HomeSeed } from "@/components/home/seed";
import { HomeTrending } from "@/components/home/trending";
import { scheduleCurrentServerExceptionCapture } from "@/lib/analytics/server";
import { fetchAuthQuery, getToken } from "@/lib/auth/server";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { preloadViewer } from "@/lib/identity/server";
import { readOnboardingStatus } from "@/lib/onboarding/server";

type HomeRecentRows = FunctionReturnType<
  typeof api.contents.queries.recent.getRecentlyViewed
>;

/** Expected failure while resolving the signed-in home feed. */
class HomeFeedError extends Schema.TaggedError<HomeFeedError>()(
  "HomeFeedError",
  { cause: Schema.Unknown, source: Schema.Literals(["recent", "viewer"]) }
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

  const [recentRows, viewer] = await Promise.all([
    resolveRecentRows(locale),
    resolveViewerSeed(),
  ]);

  return (
    <div className="relative min-h-[calc(100svh-4rem)] lg:min-h-svh">
      <HomeSeed viewer={viewer}>
        <Feed locale={locale} recentRows={recentRows} />
      </HomeSeed>
    </div>
  );
}

/** Reads the Continue Learning rows, degrading to an empty list on failure. */
function resolveRecentRows(locale: PublicAppLocale) {
  const emptyRecentRows: HomeRecentRows = [];
  return Effect.runPromise(
    Effect.tryPromise({
      catch: (cause) => new HomeFeedError({ cause, source: "recent" }),
      try: () =>
        fetchAuthQuery(api.contents.queries.recent.getRecentlyViewed, {
          locale,
          limit: 5,
        }),
    }).pipe(
      Effect.catchTag("HomeFeedError", (error) =>
        scheduleCurrentServerExceptionCapture(error.cause, {
          source: "home-feed",
        }).pipe(Effect.as(emptyRecentRows))
      )
    )
  );
}

/** Preloads the account so the home greeting is correct on first paint. */
function resolveViewerSeed() {
  return Effect.runPromise(
    Effect.tryPromise({
      catch: (cause) => new HomeFeedError({ cause, source: "viewer" }),
      try: () => preloadViewer(),
    }).pipe(
      Effect.catchTag("HomeFeedError", (error) =>
        scheduleCurrentServerExceptionCapture(error.cause, {
          source: "home-viewer",
        }).pipe(Effect.as(null))
      )
    )
  );
}

/** Renders the authenticated home feed in the existing Nakafa home order. */
function Feed({
  locale,
  recentRows,
}: {
  locale: PublicAppLocale;
  recentRows: HomeRecentRows;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-24">
      <div className="relative flex flex-col gap-12">
        <HomeHeader />

        <HomeExplore />

        <HomeContinueLearning subjects={recentRows} />

        <Suspense fallback={null}>
          <HomeTrending locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
