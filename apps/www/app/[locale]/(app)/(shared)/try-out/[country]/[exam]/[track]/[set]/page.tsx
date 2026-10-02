import { Clock, Effect, Option } from "effect";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache, Suspense } from "react";
import {
  createRetainedTryoutMetadata,
  generateTryoutRouteMetadata,
} from "@/components/tryout/catalog/metadata";
import {
  readTryoutSetAttemptPage,
  readTryoutSetPage,
} from "@/components/tryout/catalog/server";
import { loadSignedTryoutContent } from "@/components/tryout/content/signed";
import { readTryoutQuestionPreview } from "@/components/tryout/preview/read";
import { TryoutQuestionPreview } from "@/components/tryout/preview/server";
import { TryoutReview } from "@/components/tryout/review/server";
import { readCurrentTryoutSet } from "@/components/tryout/route/current";
import { createTryoutSetRestartTarget } from "@/components/tryout/route/owner";
import {
  getTryoutAttemptAuthHref,
  getTryoutHref,
  readTryoutRouteAttemptCapability,
  type TryoutRouteSearchParams,
} from "@/components/tryout/route/path";
import { TryoutClockProvider } from "@/components/tryout/runtime/clock";
import { TryoutSetPageClient } from "@/components/tryout/set/client";
import type {
  SetPage,
  TryoutSetRestartTarget,
  TryoutSetRoute,
} from "@/components/tryout/set/model";
import { TryoutSetPending } from "@/components/tryout/set/pending";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

interface TryoutSetParams {
  country: string;
  exam: string;
  locale: string;
  set: string;
  track: string;
}

interface TryoutSetPageProps {
  params: Promise<TryoutSetParams>;
  searchParams: Promise<TryoutRouteSearchParams>;
}

/** The learner's attempt a set page renders, once it is known. */
type SetAttemptPage = Effect.Success<ReturnType<typeof readCurrentTryoutSet>>;

/** The one attempt a set URL is bound to, once the request's learner is known. */
type RetainedSetRead =
  | { readonly kind: "auth-required" }
  | {
      readonly attemptPage: Effect.Success<
        ReturnType<typeof readTryoutSetAttemptPage>
      >;
      readonly kind: "owned";
    };

/**
 * Lets a navigation into a set wait instead of showing an empty page. Set links
 * prefetch on intent, which resolves the set's catalog view before the click,
 * and the learner's attempt streams in below its heading. A link bound to an
 * attempt waits for that attempt, so moving through a running attempt keeps
 * the previous page on screen until the next one is ready.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant#disabling-instant
 * @see https://nextjs.org/docs/app/guides/optimizing-prefetching#resolve-url-data-at-prefetch-time
 */
export const instant = false;

/** Builds route-owned metadata for one localized try-out set. */
export async function generateMetadata({
  params,
  searchParams,
}: TryoutSetPageProps) {
  const { country, exam, locale: localeParam, set, track } = await params;
  const capability = readTryoutRouteAttemptCapability(await searchParams);
  if (capability.kind === "invalid") {
    notFound();
  }
  const locale = getLocaleOrThrow(localeParam);
  const publicPath = getTryoutHref({ country, exam, set, track }).slice(1);
  if (capability.kind === "valid") {
    const [retained, tTryouts] = await Promise.all([
      readRetainedSetPage(locale, publicPath, capability.attemptId),
      getTranslations({ locale, namespace: "Tryouts" }),
    ]);
    if (retained.kind === "auth-required") {
      return createRetainedTryoutMetadata({
        description: tTryouts("metadata-description"),
        title: tTryouts("title"),
      });
    }
    if (retained.attemptPage?.kind !== "retained") {
      notFound();
    }
    return createRetainedTryoutMetadata({
      description:
        retained.attemptPage.page.set.description ??
        tTryouts("metadata-description"),
      title: retained.attemptPage.page.set.title,
    });
  }
  const preview = await readTryoutQuestionPreview(locale, publicPath);
  if (Option.isSome(preview)) {
    const tTryouts = await getTranslations({ locale, namespace: "Tryouts" });
    return createRetainedTryoutMetadata({
      description:
        preview.value.target.section.description ??
        tTryouts("metadata-description"),
      title: preview.value.target.section.title,
    });
  }
  return generateTryoutRouteMetadata({ kind: "set", locale, publicPath });
}

/**
 * Renders one try-out set. A public set paints its catalog view at once and
 * streams the learner's attempt into it; a set bound to one attempt renders
 * when that attempt is known.
 */
export default async function Page({
  params,
  searchParams,
}: TryoutSetPageProps) {
  const { country, exam, locale: localeParam, set, track } = await params;
  const capability = readTryoutRouteAttemptCapability(await searchParams);
  if (capability.kind === "invalid") {
    notFound();
  }
  const route = {
    country,
    exam,
    locale: getLocaleOrThrow(localeParam),
    set,
    track,
  };
  const setPath = getTryoutHref(route).slice(1);
  if (capability.kind === "valid") {
    return (
      <RetainedTryoutSet
        attemptId={capability.attemptId}
        route={route}
        setPath={setPath}
      />
    );
  }
  const preview = await readTryoutQuestionPreview(route.locale, setPath);
  if (Option.isSome(preview)) {
    return <TryoutQuestionPreview content={preview.value} />;
  }
  const page = await readTryoutSetPage(route.locale, setPath);
  if (!page) {
    notFound();
  }

  return (
    <Suspense fallback={<TryoutSetPending locale={route.locale} page={page} />}>
      <CurrentTryoutSet page={page} route={route} />
    </Suspense>
  );
}

/**
 * Resolves the learner's latest attempt on a public set. A finished attempt
 * adds its score below the catalog view the pending page already showed and
 * opens its own sections. A running attempt renders here as its own page, so
 * reaching it from a public link never passes an empty one.
 */
async function CurrentTryoutSet({
  page,
  route,
}: {
  page: SetPage;
  route: TryoutSetRoute;
}) {
  const token = await getToken();
  const attemptPage = token
    ? await Effect.runPromise(
        readCurrentTryoutSet(token, {
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale: route.locale,
          setKey: page.set.setKey,
          trackKey: page.set.trackKey,
        })
      )
    : null;
  if (attemptPage?.kind === "retained") {
    return (
      <ResolvedTryoutSet
        attemptPage={attemptPage}
        page={attemptPage.page}
        restartTarget={attemptPage.restartTarget}
        route={route}
      />
    );
  }

  return (
    <ResolvedTryoutSet
      attemptPage={attemptPage}
      page={page}
      restartTarget={
        attemptPage
          ? attemptPage.restartTarget
          : createTryoutSetRestartTarget(page)
      }
      route={route}
    />
  );
}

/** Resolves the one attempt a set URL is bound to. */
async function RetainedTryoutSet({
  attemptId,
  route,
  setPath,
}: {
  attemptId: string;
  route: TryoutSetRoute;
  setPath: string;
}) {
  const retained = await readRetainedSetPage(route.locale, setPath, attemptId);
  if (retained.kind === "auth-required") {
    redirect(getTryoutAttemptAuthHref(route.locale, setPath, attemptId));
  }
  if (retained.attemptPage?.kind !== "retained") {
    notFound();
  }

  return (
    <ResolvedTryoutSet
      attemptPage={retained.attemptPage}
      page={retained.attemptPage.page}
      restartTarget={retained.attemptPage.restartTarget}
      route={route}
    />
  );
}

/** Composes signed runtime or review content after route ownership is resolved. */
async function ResolvedTryoutSet({
  attemptPage,
  page,
  restartTarget,
  route,
}: {
  attemptPage: SetAttemptPage;
  page: SetPage;
  restartTarget: TryoutSetRestartTarget | null;
  route: TryoutSetRoute;
}) {
  const initialNow = await Effect.runPromise(Clock.currentTimeMillis);

  const signedContent =
    attemptPage?.content.kind === "signed" &&
    attemptPage.initialState.attempt.status === "in-progress"
      ? Effect.runPromise(
          loadSignedTryoutContent(attemptPage.attemptId, attemptPage.content)
        )
      : null;
  const reviewRuntime =
    attemptPage?.content.kind === "signed" &&
    attemptPage.initialState.attempt.status !== "in-progress"
      ? attemptPage.initialState.runtime
      : null;

  return (
    <TryoutClockProvider initialNow={initialNow}>
      <TryoutSetPageClient
        binding={
          attemptPage
            ? {
                attemptId: attemptPage.attemptId,
                initialState: attemptPage.initialState,
                sectionRoutes: attemptPage.page.sections,
              }
            : null
        }
        content={reviewRuntime ? null : signedContent}
        page={page}
        restartTarget={restartTarget}
        route={route}
      >
        {attemptPage?.content.kind === "signed" && reviewRuntime ? (
          <TryoutReview
            access={attemptPage.content}
            attemptId={attemptPage.attemptId}
            runtime={reviewRuntime}
          />
        ) : null}
      </TryoutSetPageClient>
    </TryoutClockProvider>
  );
}

/** Reads one attempt the request's learner owns, once per request. */
const readRetainedSetPage = cache(
  async (
    locale: ReturnType<typeof getLocaleOrThrow>,
    publicPath: string,
    attemptId: string
  ): Promise<RetainedSetRead> => {
    const token = await getToken();
    if (!token) {
      return { kind: "auth-required" };
    }
    const attemptPage = await Effect.runPromise(
      readTryoutSetAttemptPage(token, {
        attemptId,
        kind: "retained",
        locale,
        publicPath,
      })
    );
    return { attemptPage, kind: "owned" };
  }
);
