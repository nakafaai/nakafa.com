import { Effect } from "effect";
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
import type {
  TryoutAnswerContent,
  TryoutQuestionContent,
} from "@/components/tryout/content/model";
import { loadSignedTryoutContent } from "@/components/tryout/content/signed";
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
import { normalizeTryoutAttemptState } from "@/components/tryout/runtime/bootstrap";
import { TryoutSetPageClient } from "@/components/tryout/set/client";
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

/** Renders one try-out set and its section list. */
export default function Page(props: TryoutSetPageProps) {
  return (
    <Suspense fallback={null}>
      <TryoutSetRoute params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

/** Resolves one public or explicitly retained set inside its route boundary. */
async function TryoutSetRoute({ params, searchParams }: TryoutSetPageProps) {
  const { country, exam, locale: localeParam, set, track } = await params;
  const capability = readTryoutRouteAttemptCapability(await searchParams);
  if (capability.kind === "invalid") {
    notFound();
  }
  const attemptId =
    capability.kind === "valid" ? capability.attemptId : undefined;
  const locale = getLocaleOrThrow(localeParam);
  const setPath = getTryoutHref({ country, exam, set, track }).slice(1);
  const resolved = await readRoutePage(locale, setPath, attemptId);

  if (resolved.authRequired && attemptId) {
    redirect(getTryoutAttemptAuthHref(locale, setPath, attemptId));
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
    <TryoutSetPageClient
      binding={
        attemptPage
          ? {
              attemptId: attemptPage.attemptId,
              initialState: normalizeTryoutAttemptState(
                attemptPage.initialState
              ),
              sectionRoutes: attemptPage.page.sections,
            }
          : null
      }
      content={{ entryAnswers: answers, entryQuestions: questions }}
      page={page}
      restartTarget={restartTarget}
      route={{ country, exam, locale, set, track }}
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
