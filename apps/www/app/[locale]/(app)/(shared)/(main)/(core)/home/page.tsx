import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import refs from "@repo/backend/confect/_generated/refs";
import { redirect } from "@repo/internationalization/src/navigation";
import type { PublicAppLocale } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HomeContinueLearning } from "@/components/home/continue-learning";
import { HomeExplore } from "@/components/home/explore";
import { HomeHeader } from "@/components/home/header";
import { HomeTrending } from "@/components/home/trending";
import { env } from "@/env";
import { getToken } from "@/lib/auth/server";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { readOnboardingStatus } from "@/lib/onboarding/server";

type HomeRecentRows = Ref.Returns<
  typeof refs.public.contents.queries.recent.getRecentlyViewed
>;

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

  const { account, recentRows } = await Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) =>
        Effect.all(
          {
            account: client.query(refs.public.auth.queries.getCurrentUser, {}),
            recentRows: client.query(
              refs.public.contents.queries.recent.getRecentlyViewed,
              { locale, limit: 5 }
            ),
          },
          { concurrency: "unbounded" }
        )
      ),
      Effect.provide(
        HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL, { auth: token })
      )
    )
  );

  return (
    <div className="relative min-h-[calc(100svh-4rem)] lg:min-h-svh">
      <Feed
        locale={locale}
        name={account?.authUser.name ?? null}
        recentRows={recentRows}
      />
    </div>
  );
}

/** Renders the authenticated home feed in the existing Nakafa home order. */
function Feed({
  locale,
  name,
  recentRows,
}: {
  locale: PublicAppLocale;
  name: string | null;
  recentRows: HomeRecentRows;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-24">
      <div className="relative flex flex-col gap-12">
        <HomeHeader name={name} />

        <HomeExplore />

        <HomeContinueLearning subjects={recentRows} />

        <Suspense fallback={null}>
          <HomeTrending locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
