import { Effect } from "effect";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache, Suspense } from "react";
import {
  createRetainedTryoutMetadata,
  generateTryoutRouteMetadata,
} from "@/components/tryout/catalog/metadata";
import {
  preloadTryoutSetState,
  readTryoutAttemptSetRoute,
  readTryoutSetPage,
} from "@/components/tryout/catalog/server";
import type {
  TryoutAnswerContent,
  TryoutQuestionContent,
} from "@/components/tryout/content/model";
import { loadSignedTryoutContent } from "@/components/tryout/content/signed";
import {
  getTryoutAttemptAuthHref,
  getTryoutHref,
  readTryoutAttemptId,
  type TryoutRouteSearchParams,
} from "@/components/tryout/route/path";
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
  const attemptId = readTryoutAttemptId(await searchParams);
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
  if (resolved.attemptPage) {
    const tTryouts = await getTranslations({ locale, namespace: "Tryouts" });
    return createRetainedTryoutMetadata({
      description:
        resolved.attemptPage.page.set.description ??
        tTryouts("metadata-description"),
      title: resolved.attemptPage.page.set.title,
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
  const attemptId = readTryoutAttemptId(await searchParams);
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
  const page = attemptPage?.page ?? resolved.publicPage;
  if (!page) {
    notFound();
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
    <TryoutSetPageClient
      attemptId={attemptPage?.attemptId}
      content={{ entryAnswers: answers, entryQuestions: questions }}
      page={page}
      preloadedState={resolved.preloadedState}
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
    const stateArgs = { attemptId, locale, publicPath };
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
            attemptPage: readTryoutAttemptSetRoute(
              token,
              locale,
              publicPath,
              attemptId
            ),
            preloadedState: preloadTryoutSetState(token, stateArgs),
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
      readTryoutSetPage(locale, publicPath),
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
      readTryoutAttemptSetRoute(token, locale, publicPath)
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
      preloadTryoutSetState(token, {
        ...stateArgs,
        attemptId: attemptPage.attemptId,
      })
    );
    return { attemptPage, authRequired: false, preloadedState, publicPage };
  }
);
