import { Clock, Effect, Option } from "effect";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache, Suspense } from "react";
import {
  createRetainedTryoutMetadata,
  generateTryoutRouteMetadata,
} from "@/components/tryout/catalog/metadata";
import {
  readTryoutSectionAttemptPage,
  readTryoutSectionPage,
} from "@/components/tryout/catalog/server";
import { loadSignedTryoutContent } from "@/components/tryout/content/signed";
import { readTryoutQuestionPreview } from "@/components/tryout/preview/read";
import { TryoutQuestionPreview } from "@/components/tryout/preview/server";
import { TryoutReview } from "@/components/tryout/review/server";
import { selectTryoutSectionReturnHref } from "@/components/tryout/route/owner";
import {
  getTryoutAttemptAuthHref,
  getTryoutAttemptHref,
  getTryoutHref,
  getTryoutPublicPathHref,
  readTryoutRouteAttemptCapability,
  type TryoutRouteSearchParams,
} from "@/components/tryout/route/path";
import { TryoutClockProvider } from "@/components/tryout/runtime/clock";
import { TryoutSectionPageClient } from "@/components/tryout/section/client";
import type { TryoutSectionPage } from "@/components/tryout/section/model";
import { TryoutSectionPending } from "@/components/tryout/section/pending";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

interface TryoutSectionParams {
  country: string;
  exam: string;
  locale: string;
  section: string;
  set: string;
  track: string;
}

interface TryoutSectionPageProps {
  params: Promise<TryoutSectionParams>;
  searchParams: Promise<TryoutRouteSearchParams>;
}

type TryoutSectionRoute = Omit<TryoutSectionParams, "locale"> & {
  locale: ReturnType<typeof getLocaleOrThrow>;
};

/**
 * Lets a navigation into a section wait for the section's heading instead of
 * showing an empty page. Section links prefetch on intent, which resolves the
 * heading before the click, and the learner's attempt streams in below it. A
 * link bound to an attempt waits for that attempt, so moving through a running
 * attempt keeps the previous page, and the locked shell, on screen until the
 * next page is ready.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant#disabling-instant
 * @see https://nextjs.org/docs/app/guides/optimizing-prefetching#resolve-url-data-at-prefetch-time
 */
export const instant = false;

/** Builds route-owned metadata for one localized try-out section. */
export async function generateMetadata({
  params,
  searchParams,
}: TryoutSectionPageProps) {
  const {
    country,
    exam,
    locale: localeParam,
    section,
    set,
    track,
  } = await params;
  const capability = readTryoutRouteAttemptCapability(await searchParams);
  if (capability.kind === "invalid") {
    notFound();
  }
  const attemptId =
    capability.kind === "valid" ? capability.attemptId : undefined;
  const locale = getLocaleOrThrow(localeParam);
  const publicPath = getTryoutHref({
    country,
    exam,
    section,
    set,
    track,
  }).slice(1);
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
  if (resolved.attemptPage?.kind === "retained") {
    return createRetainedTryoutMetadata({
      ...(resolved.attemptPage.page.section.description === undefined
        ? {}
        : { description: resolved.attemptPage.page.section.description }),
      title: resolved.attemptPage.page.section.title,
    });
  }
  if (resolved.publicPage) {
    return generateTryoutRouteMetadata({
      kind: "section",
      locale,
      publicPath,
    });
  }
  notFound();
}

/**
 * Renders one try-out section. A public section shows its catalog heading at
 * once and streams the learner's attempt below it; a section bound to one
 * attempt renders when that attempt is known.
 */
export default async function Page({
  params,
  searchParams,
}: TryoutSectionPageProps) {
  const {
    country,
    exam,
    locale: localeParam,
    section,
    set,
    track,
  } = await params;
  const capability = readTryoutRouteAttemptCapability(await searchParams);
  if (capability.kind === "invalid") {
    notFound();
  }
  const route = {
    country,
    exam,
    locale: getLocaleOrThrow(localeParam),
    section,
    set,
    track,
  };
  const sectionPath = getTryoutHref(route).slice(1);
  if (capability.kind === "valid") {
    return (
      <TryoutSectionRoute
        attemptId={capability.attemptId}
        route={route}
        sectionPath={sectionPath}
      />
    );
  }
  const preview = await readTryoutQuestionPreview(route.locale, sectionPath);
  if (Option.isSome(preview)) {
    return <TryoutQuestionPreview content={preview.value} />;
  }
  const publicPage = await readTryoutSectionPage(route.locale, sectionPath);
  if (!publicPage) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <TryoutSectionPending
          locale={route.locale}
          page={publicPage}
          setHref={getTryoutHref({ country, exam, set, track })}
        />
      }
    >
      <TryoutSectionRoute route={route} sectionPath={sectionPath} />
    </Suspense>
  );
}

/** Resolves the current or retained attempt that decides the section view. */
async function TryoutSectionRoute({
  attemptId,
  route,
  sectionPath,
}: {
  attemptId?: string;
  route: TryoutSectionRoute;
  sectionPath: string;
}) {
  const resolved = await readRoutePage(route.locale, sectionPath, attemptId);
  if (resolved.authRequired && attemptId) {
    redirect(getTryoutAttemptAuthHref(route.locale, sectionPath, attemptId));
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
  const page = attemptPage?.page ?? resolved.publicPage;

  if (!page) {
    notFound();
  }

  const setHref = selectTryoutSectionReturnHref({
    attemptPage,
    publicHref: getTryoutHref({
      country: route.country,
      exam: route.exam,
      set: route.set,
      track: route.track,
    }),
  });

  return (
    <ResolvedTryoutSectionRoute
      attemptPage={attemptPage}
      page={page}
      route={route}
      setHref={setHref}
    />
  );
}

/** Composes signed runtime or review content after route ownership is resolved. */
async function ResolvedTryoutSectionRoute({
  attemptPage,
  page,
  route,
  setHref,
}: {
  attemptPage: Exclude<
    Awaited<ReturnType<typeof readRoutePage>>["attemptPage"],
    { kind: "redirect" }
  >;
  page: TryoutSectionPage;
  route: TryoutSectionRoute;
  setHref: string;
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
  const startHref = attemptPage?.activeSectionPublicPath
    ? getTryoutPublicPathHref(attemptPage.activeSectionPublicPath)
    : null;

  return (
    <TryoutClockProvider initialNow={initialNow}>
      <TryoutSectionPageClient
        binding={
          attemptPage
            ? {
                attemptId: attemptPage.attemptId,
                initialState: attemptPage.initialState,
                startHref,
              }
            : null
        }
        content={reviewRuntime ? null : signedContent}
        page={page}
        route={route}
        setHref={setHref}
      >
        {attemptPage?.content.kind === "signed" && reviewRuntime ? (
          <TryoutReview
            access={attemptPage.content}
            attemptId={attemptPage.attemptId}
            runtime={reviewRuntime}
          />
        ) : null}
      </TryoutSectionPageClient>
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
        readTryoutSectionAttemptPage(token, {
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
      readTryoutSectionPage(locale, publicPath),
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
      readTryoutSectionAttemptPage(token, {
        countryKey: publicPage.set.countryKey,
        examKey: publicPage.set.examKey,
        kind: "current",
        locale,
        sectionKey: publicPage.section.sectionKey,
        setKey: publicPage.set.setKey,
        trackKey: publicPage.set.trackKey,
      })
    );
    return { attemptPage, authRequired: false, publicPage };
  }
);
