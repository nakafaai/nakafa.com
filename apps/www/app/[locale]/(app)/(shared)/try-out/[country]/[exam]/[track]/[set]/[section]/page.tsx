import { Clock, Effect, Option, Schema } from "effect";
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
import { readCurrentTryoutSection } from "@/components/tryout/route/current";
import { selectTryoutSectionReturnHref } from "@/components/tryout/route/owner";
import {
  getTryoutAttemptAuthHref,
  getTryoutHref,
  getTryoutPublicPathHref,
  readTryoutRouteAttemptCapability,
  type TryoutRouteSearchParams,
} from "@/components/tryout/route/path";
import { TryoutClockProvider } from "@/components/tryout/runtime/clock";
import { TryoutSectionPageClient } from "@/components/tryout/section/client";
import type {
  TryoutSectionPage,
  TryoutSectionRoute,
} from "@/components/tryout/section/model";
import { TryoutSectionPending } from "@/components/tryout/section/pending";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Raw route params of one section URL, before its locale is validated. */
const TryoutSectionParamsSchema = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  locale: Schema.String,
  section: Schema.String,
  set: Schema.String,
  track: Schema.String,
});

type TryoutSectionParams = typeof TryoutSectionParamsSchema.Type;

interface TryoutSectionPageProps {
  params: Promise<TryoutSectionParams>;
  searchParams: Promise<TryoutRouteSearchParams>;
}

/** The running attempt a section page renders, once it is known. */
type SectionAttemptPage = Effect.Success<
  ReturnType<typeof readCurrentTryoutSection>
>;

/** The one attempt a section URL is bound to, read for the request's learner. */
type RetainedSectionPage = Effect.Success<
  ReturnType<typeof readTryoutSectionAttemptPage>
>;

/**
 * Lets a navigation into a section wait instead of showing an empty page.
 * Section links prefetch on intent, which resolves the section's catalog view
 * before the click, and the learner's attempt streams in below its heading. A
 * link bound to an attempt waits for that attempt, so moving through a running
 * attempt keeps the previous page on screen until the next one is ready.
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
  const locale = getLocaleOrThrow(localeParam);
  const publicPath = getTryoutHref({
    country,
    exam,
    section,
    set,
    track,
  }).slice(1);
  if (capability.kind === "valid") {
    const retained = await readRetainedSectionPage(
      locale,
      publicPath,
      capability.attemptId
    );
    if (Option.isNone(retained)) {
      const tTryouts = await getTranslations({ locale, namespace: "Tryouts" });
      return createRetainedTryoutMetadata({
        description: tTryouts("metadata-description"),
        title: tTryouts("title"),
      });
    }
    const attemptPage = retained.value;
    if (attemptPage?.kind !== "retained") {
      notFound();
    }
    const frozen = attemptPage.page.section;
    return createRetainedTryoutMetadata({
      ...(frozen.description === undefined
        ? {}
        : { description: frozen.description }),
      title: frozen.title,
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
  return generateTryoutRouteMetadata({ kind: "section", locale, publicPath });
}

/**
 * Renders one try-out section. A public section paints its catalog view at
 * once and streams the learner's attempt into it; a section bound to one
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
  const setHref = getTryoutHref({ country, exam, set, track });
  if (capability.kind === "valid") {
    return (
      <RetainedTryoutSection
        attemptId={capability.attemptId}
        route={route}
        sectionPath={sectionPath}
        setHref={setHref}
      />
    );
  }
  const preview = await readTryoutQuestionPreview(route.locale, sectionPath);
  if (Option.isSome(preview)) {
    return <TryoutQuestionPreview content={preview.value} />;
  }
  const page = await readTryoutSectionPage(route.locale, sectionPath);
  if (!page) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <TryoutSectionPending
          locale={route.locale}
          page={page}
          setHref={setHref}
        />
      }
    >
      <CurrentTryoutSection page={page} route={route} setHref={setHref} />
    </Suspense>
  );
}

/**
 * Resolves the learner's attempt on a public section. A running attempt
 * through this section renders here as its own page, so reaching it from a
 * public link never passes an empty one.
 */
async function CurrentTryoutSection({
  page,
  route,
  setHref,
}: {
  page: TryoutSectionPage;
  route: TryoutSectionRoute;
  setHref: string;
}) {
  const token = await getToken();
  const attemptPage = token
    ? await Effect.runPromise(
        readCurrentTryoutSection(token, {
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale: route.locale,
          sectionKey: page.section.sectionKey,
          setKey: page.set.setKey,
          trackKey: page.set.trackKey,
        })
      )
    : null;

  return (
    <ResolvedTryoutSection
      attemptPage={attemptPage}
      page={attemptPage ? attemptPage.page : page}
      route={route}
      setHref={selectTryoutSectionReturnHref({
        attemptPage,
        publicHref: setHref,
      })}
    />
  );
}

/** Resolves the one attempt a section URL is bound to. */
async function RetainedTryoutSection({
  attemptId,
  route,
  sectionPath,
  setHref,
}: {
  attemptId: string;
  route: TryoutSectionRoute;
  sectionPath: string;
  setHref: string;
}) {
  const retained = await readRetainedSectionPage(
    route.locale,
    sectionPath,
    attemptId
  );
  if (Option.isNone(retained)) {
    redirect(getTryoutAttemptAuthHref(route.locale, sectionPath, attemptId));
  }
  const attemptPage = retained.value;
  if (attemptPage?.kind !== "retained") {
    notFound();
  }

  return (
    <ResolvedTryoutSection
      attemptPage={attemptPage}
      page={attemptPage.page}
      route={route}
      setHref={selectTryoutSectionReturnHref({
        attemptPage,
        publicHref: setHref,
      })}
    />
  );
}

/** Composes signed runtime or review content after route ownership is resolved. */
async function ResolvedTryoutSection({
  attemptPage,
  page,
  route,
  setHref,
}: {
  attemptPage: SectionAttemptPage;
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

/**
 * Reads one attempt the request's learner owns, once per request, or nothing
 * when the request has no learner to read it for.
 */
const readRetainedSectionPage = cache(
  async (
    locale: ReturnType<typeof getLocaleOrThrow>,
    publicPath: string,
    attemptId: string
  ): Promise<Option.Option<RetainedSectionPage>> => {
    const token = await getToken();
    if (!token) {
      return Option.none();
    }
    const attemptPage = await Effect.runPromise(
      readTryoutSectionAttemptPage(token, {
        attemptId,
        kind: "retained",
        locale,
        publicPath,
      })
    );
    return Option.some(attemptPage);
  }
);
