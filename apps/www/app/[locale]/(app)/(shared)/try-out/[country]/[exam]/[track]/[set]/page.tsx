import { Effect } from "effect";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  createRetainedTryoutMetadata,
  generateTryoutRouteMetadata,
} from "@/components/tryout/catalog/metadata";
import {
  readTryoutAttemptSetPage,
  readTryoutSetPage,
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
  getTryoutAttemptHref,
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

  const { attemptPage, token } = resolved;
  if (!attemptId && attemptPage) {
    redirect(
      getTryoutAttemptHref(
        attemptPage.page.set.publicPath,
        attemptPage.attemptId
      )
    );
  }
  const page = attemptPage?.page ?? resolved.publicPage;
  if (!page) {
    notFound();
  }

  const entrySection = page.entrySection;
  let contentAccess: TryoutContentAccess = { kind: "none" };

  if (token && entrySection?.visibility === "internal-entry") {
    contentAccess = await Effect.runPromise(
      readTryoutContentAccess(token, {
        ...(attemptPage ? { attemptId: attemptPage.attemptId } : {}),
        countryKey: page.set.countryKey,
        examKey: page.set.examKey,
        locale,
        sectionKey: entrySection.sectionKey,
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
    <TryoutSetPageClient
      attemptId={attemptPage?.attemptId}
      content={{ entryAnswers: answers, entryQuestions: questions }}
      page={page}
      route={{ country, exam, locale, set, track }}
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
    readTryoutSetPage(locale, publicPath),
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
    readTryoutAttemptSetPage(token, locale, publicPath, attemptId)
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
