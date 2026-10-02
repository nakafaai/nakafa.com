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
import {
  createTryoutSetRestartTarget,
  selectTryoutFrozenPage,
  selectTryoutSetPages,
} from "@/components/tryout/route/owner";
import {
  getTryoutAttemptAuthHref,
  getTryoutAttemptHref,
  getTryoutHref,
  readTryoutRouteAttemptCapability,
  type TryoutRouteSearchParams,
} from "@/components/tryout/route/path";
import { TryoutClockProvider } from "@/components/tryout/runtime/clock";
import { TryoutSetPageClient } from "@/components/tryout/set/client";
import type {
  SetPage,
  TryoutSetRoute as SetRoute,
  TryoutSetRestartTarget,
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

/**
 * Lets a navigation into a set wait for the set's heading instead of showing an
 * empty page. Set links prefetch on intent, which resolves the heading before
 * the click, and the learner's attempt streams in below it. A link bound to an
 * attempt waits for that attempt, so moving through a running attempt keeps
 * the previous page, and the locked shell, on screen until the next page is
 * ready.
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
  const attemptId =
    capability.kind === "valid" ? capability.attemptId : undefined;
  const locale = getLocaleOrThrow(localeParam);
  const publicPath = getTryoutHref({ country, exam, set, track }).slice(1);
  const preview = attemptId
    ? Option.none()
    : await readTryoutQuestionPreview(locale, publicPath);
  if (Option.isSome(preview)) {
    const tTryouts = await getTranslations({ locale, namespace: "Tryouts" });
    return createRetainedTryoutMetadata({
      description:
        preview.value.target.section.description ??
        tTryouts("metadata-description"),
      title: preview.value.target.section.title,
    });
  }
  const resolved = await readRoutePage(locale, publicPath, attemptId);

  if (resolved.authRequired) {
    const tTryouts = await getTranslations({ locale, namespace: "Tryouts" });
    return createRetainedTryoutMetadata({
      description: tTryouts("metadata-description"),
      title: tTryouts("title"),
    });
  }
  const frozenPage = selectTryoutFrozenPage(resolved.attemptPage);
  if (frozenPage) {
    const tTryouts = await getTranslations({ locale, namespace: "Tryouts" });
    return createRetainedTryoutMetadata({
      description:
        frozenPage.set.description ?? tTryouts("metadata-description"),
      title: frozenPage.set.title,
    });
  }
  if (resolved.publicPage) {
    return generateTryoutRouteMetadata({
      kind: "set",
      locale,
      publicPath,
    });
  }
  notFound();
}

/**
 * Renders one try-out set. A public set shows its catalog heading at once and
 * streams the learner's attempt below it; a set bound to one attempt renders
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
      <TryoutSetRoute
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
  const publicPage = await readTryoutSetPage(route.locale, setPath);
  if (!publicPage) {
    notFound();
  }

  return (
    <Suspense
      fallback={<TryoutSetPending locale={route.locale} page={publicPage} />}
    >
      <TryoutSetRoute route={route} setPath={setPath} />
    </Suspense>
  );
}

/** Resolves the current or retained attempt that decides the set view. */
async function TryoutSetRoute({
  attemptId,
  route,
  setPath,
}: {
  attemptId?: string;
  route: SetRoute;
  setPath: string;
}) {
  const resolved = await readRoutePage(route.locale, setPath, attemptId);

  if (resolved.authRequired && attemptId) {
    redirect(getTryoutAttemptAuthHref(route.locale, setPath, attemptId));
  }
  if (resolved.authRequired) {
    notFound();
  }

  const { attemptPage } = resolved;
  if (attemptPage?.kind === "redirect") {
    redirect(
      getTryoutAttemptHref(attemptPage.publicPath, attemptPage.attemptId)
    );
  }
  if (attemptId && !attemptPage) {
    notFound();
  }
  const pages = selectTryoutSetPages({
    attemptPage,
    publicPage: resolved.publicPage,
    publicRestartTarget: resolved.publicPage
      ? createTryoutSetRestartTarget(resolved.publicPage)
      : null,
  });
  if (!pages) {
    notFound();
  }
  const { page, restartTarget } = pages;

  return (
    <ResolvedTryoutSetRoute
      attemptPage={attemptPage}
      page={page}
      restartTarget={restartTarget}
      route={route}
    />
  );
}

/** Composes signed runtime or review content after route ownership is resolved. */
async function ResolvedTryoutSetRoute({
  attemptPage,
  page,
  restartTarget,
  route,
}: {
  attemptPage: Exclude<
    Awaited<ReturnType<typeof readRoutePage>>["attemptPage"],
    { kind: "redirect" }
  >;
  page: SetPage;
  restartTarget: TryoutSetRestartTarget | null;
  route: SetRoute;
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

/** Resolves active public content or one explicitly owned frozen attempt. */
const readRoutePage = cache(
  async (
    locale: ReturnType<typeof getLocaleOrThrow>,
    publicPath: string,
    attemptId?: string
  ) => {
    if (attemptId) {
      const token = await getToken();
      if (!token) {
        return {
          attemptPage: null,
          authRequired: true,
          publicPage: null,
        };
      }
      const attemptPage = await Effect.runPromise(
        readTryoutSetAttemptPage(token, {
          attemptId,
          kind: "retained",
          locale,
          publicPath,
        })
      );
      return {
        attemptPage,
        authRequired: false,
        publicPage: null,
      };
    }

    const [publicPage, token] = await Promise.all([
      readTryoutSetPage(locale, publicPath),
      getToken(),
    ]);
    if (!token) {
      return {
        attemptPage: null,
        authRequired: false,
        publicPage,
      };
    }

    if (!publicPage) {
      return {
        attemptPage: null,
        authRequired: false,
        publicPage,
      };
    }
    const attemptPage = await Effect.runPromise(
      readTryoutSetAttemptPage(token, {
        countryKey: publicPage.set.countryKey,
        examKey: publicPage.set.examKey,
        kind: "current",
        locale,
        setKey: publicPage.set.setKey,
        trackKey: publicPage.set.trackKey,
      })
    );
    return { attemptPage, authRequired: false, publicPage };
  }
);
