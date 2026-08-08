import { Effect } from "effect";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache, Suspense } from "react";
import {
  createRetainedTryoutMetadata,
  generateTryoutRouteMetadata,
} from "@/components/tryout/catalog/metadata";
import {
  preloadTryoutSectionState,
  readTryoutAttemptSectionRoute,
  readTryoutSectionPage,
} from "@/components/tryout/catalog/server";
import type {
  TryoutAnswerContent,
  TryoutQuestionContent,
} from "@/components/tryout/content/model";
import { loadSignedTryoutContent } from "@/components/tryout/content/signed";
import {
  getTryoutAttemptAuthHref,
  getTryoutHref,
  getTryoutPublicPathHref,
  readTryoutAttemptId,
  type TryoutRouteSearchParams,
} from "@/components/tryout/route/path";
import { TryoutSectionPageClient } from "@/components/tryout/section/client";
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
  const attemptId = readTryoutAttemptId(await searchParams);
  const locale = getLocaleOrThrow(localeParam);
  const publicPath = getTryoutHref({
    country,
    exam,
    section,
    set,
    track,
  }).slice(1);
  const resolved = await readRoutePage(locale, publicPath, attemptId);

  if (resolved.authRequired) {
    const tTryouts = await getTranslations({ locale, namespace: "Tryouts" });
    return createRetainedTryoutMetadata({
      description: tTryouts("metadata-description"),
      title: tTryouts("title"),
    });
  }
  if (resolved.attemptPage) {
    return createRetainedTryoutMetadata({
      description: resolved.attemptPage.page.section.description,
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

/** Renders one try-out section with public metadata and owned runtime content. */
export default function Page(props: TryoutSectionPageProps) {
  return (
    <Suspense fallback={null}>
      <TryoutSectionRoute
        params={props.params}
        searchParams={props.searchParams}
      />
    </Suspense>
  );
}

/** Resolves one cached public section inside its route-owned boundary. */
async function TryoutSectionRoute({
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
  const attemptId = readTryoutAttemptId(await searchParams);
  const locale = getLocaleOrThrow(localeParam);
  const sectionPath = getTryoutHref({
    country,
    exam,
    section,
    set,
    track,
  }).slice(1);
  const resolved = await readRoutePage(locale, sectionPath, attemptId);
  if (resolved.authRequired && attemptId) {
    redirect(getTryoutAttemptAuthHref(locale, sectionPath, attemptId));
  }
  if (resolved.authRequired) {
    notFound();
  }
  const { attemptPage } = resolved;
  const page = attemptPage?.page ?? resolved.publicPage;

  if (!page) {
    notFound();
  }

  let setHref = getTryoutHref({ country, exam, set, track });
  if (attemptPage) {
    setHref = getTryoutHref();
    if (attemptPage.activeSetPublicPath) {
      setHref = getTryoutPublicPathHref(attemptPage.activeSetPublicPath);
    }
  }

  let questions: readonly TryoutQuestionContent[] = [];
  let answers: readonly TryoutAnswerContent[] = [];

  if (attemptPage?.content.kind === "signed") {
    const content = await Effect.runPromise(
      loadSignedTryoutContent({
        answers: attemptPage.content.answers,
        questions: attemptPage.content.questions,
      })
    );
    questions = content.questions;
    answers = content.answers;
  }

  return (
    <TryoutSectionPageClient
      binding={
        attemptPage
          ? {
              attemptId: attemptPage.attemptId,
              kind: "retained",
              startHref: attemptPage.activeSectionPublicPath
                ? getTryoutPublicPathHref(attemptPage.activeSectionPublicPath)
                : null,
            }
          : { kind: "active" }
      }
      content={{ answers, questions }}
      page={page}
      preloadedState={resolved.preloadedState}
      route={{ country, exam, locale, section, set, track }}
      setHref={setHref}
    />
  );
}

/** Resolves active public content or one explicitly owned frozen attempt. */
const readRoutePage = cache(
  async (
    locale: ReturnType<typeof getLocaleOrThrow>,
    publicPath: string,
    attemptId?: string
  ) => {
    const stateArgs = {
      attemptId,
      locale,
      publicPath,
    };
    if (attemptId) {
      const token = await getToken();
      if (!token) {
        return {
          attemptPage: null,
          authRequired: true,
          preloadedState: undefined,
          publicPage: null,
        };
      }
      const result = await Effect.runPromise(
        Effect.all(
          {
            attemptPage: readTryoutAttemptSectionRoute(
              token,
              locale,
              publicPath,
              attemptId
            ),
            preloadedState: preloadTryoutSectionState(token, stateArgs),
          },
          { concurrency: "unbounded" }
        )
      );
      return {
        ...result,
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
        preloadedState: undefined,
        publicPage,
      };
    }

    const attemptPage = await Effect.runPromise(
      readTryoutAttemptSectionRoute(token, locale, publicPath)
    );
    if (!attemptPage) {
      return {
        attemptPage: null,
        authRequired: false,
        preloadedState: undefined,
        publicPage,
      };
    }
    const preloadedState = await Effect.runPromise(
      preloadTryoutSectionState(token, {
        ...stateArgs,
        attemptId: attemptPage.attemptId,
      })
    );
    return { attemptPage, authRequired: false, preloadedState, publicPage };
  }
);
