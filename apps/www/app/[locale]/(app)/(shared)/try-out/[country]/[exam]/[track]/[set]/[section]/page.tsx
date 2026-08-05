import { Effect } from "effect";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  createRetainedTryoutMetadata,
  generateTryoutRouteMetadata,
} from "@/components/tryout/catalog/metadata";
import {
  readTryoutAttemptSectionPage,
  readTryoutSectionPage,
} from "@/components/tryout/catalog/server";
import {
  readTryoutContentAccess,
  type TryoutContentAccess,
} from "@/components/tryout/content/access";
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
  const { attemptPage, token } = resolved;
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

  let contentAccess: TryoutContentAccess = { kind: "none" };

  if (token) {
    contentAccess = await Effect.runPromise(
      readTryoutContentAccess(token, {
        ...(attemptPage ? { attemptId: attemptPage.attemptId } : {}),
        countryKey: page.set.countryKey,
        examKey: page.set.examKey,
        locale,
        sectionKey: page.section.sectionKey,
        setKey: page.set.setKey,
        trackKey: page.set.trackKey,
      })
    );
  }

  let questions: readonly TryoutQuestionContent[] = [];
  let answers: readonly TryoutAnswerContent[] = [];

  if (contentAccess.kind === "signed") {
    const content = await Effect.runPromise(
      loadSignedTryoutContent({
        answers: contentAccess.answers,
        questions: contentAccess.questions,
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
      route={{ country, exam, locale, section, set, track }}
      setHref={setHref}
    />
  );
}

/** Resolves active public content or one explicitly owned frozen attempt. */
async function readRoutePage(
  locale: ReturnType<typeof getLocaleOrThrow>,
  publicPath: string,
  attemptId?: string
) {
  const [publicPage, token] = await Promise.all([
    readTryoutSectionPage(locale, publicPath),
    getToken(),
  ]);
  if (!token) {
    if (attemptId) {
      return {
        attemptPage: null,
        authRequired: true,
        publicPage: null,
        token,
      };
    }
    return { attemptPage: null, authRequired: false, publicPage, token };
  }

  const attemptPage = await Effect.runPromise(
    readTryoutAttemptSectionPage(token, locale, publicPath, attemptId)
  );
  if (attemptId && !attemptPage) {
    return {
      attemptPage: null,
      authRequired: false,
      publicPage: null,
      token,
    };
  }
  return { attemptPage, authRequired: false, publicPage, token };
}
