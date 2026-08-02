import { Effect } from "effect";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { generateTryoutRouteMetadata } from "@/components/tryout/catalog/metadata";
import { readTryoutSetPage } from "@/components/tryout/catalog/server";
import {
  readTryoutContentAccess,
  type TryoutContentAccess,
} from "@/components/tryout/content/access";
import {
  loadFilesystemAnswers,
  loadFilesystemQuestions,
} from "@/components/tryout/content/filesystem";
import type {
  TryoutAnswerContent,
  TryoutQuestionContent,
} from "@/components/tryout/content/model";
import {
  loadSignedAnswers,
  loadSignedQuestions,
} from "@/components/tryout/content/signed";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutSetPageClient } from "@/components/tryout/set/client";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export const unstable_instant = {
  prefetch: "runtime",
  samples: [
    {
      params: {
        country: "indonesia",
        exam: "tka",
        locale: "id",
        set: "set-1",
        track: "matematika",
      },
    },
  ],
};

/** Builds route-owned metadata for one localized try-out set. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    set: string;
    track: string;
  }>;
}) {
  const { country, exam, locale: localeParam, set, track } = await params;
  const locale = getLocaleOrThrow(localeParam);

  return generateTryoutRouteMetadata({
    kind: "set",
    locale,
    publicPath: getTryoutHref({ country, exam, set, track }).slice(1),
  });
}

/** Renders one try-out set and its section list. */
export default function Page(props: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    set: string;
    track: string;
  }>;
}) {
  return (
    <Suspense fallback={null}>
      <TryoutSetRoute params={props.params} />
    </Suspense>
  );
}

/** Resolves one cached public set inside its route-owned boundary. */
async function TryoutSetRoute({
  params,
}: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    set: string;
    track: string;
  }>;
}) {
  const { country, exam, locale: localeParam, set, track } = await params;
  const locale = getLocaleOrThrow(localeParam);
  const setPath = getTryoutHref({ country, exam, set, track }).slice(1);

  const [page, token] = await Promise.all([
    readTryoutSetPage(locale, setPath),
    getToken(),
  ]);

  if (!page) {
    notFound();
  }

  const entrySection = page.entrySection;
  let contentAccess: TryoutContentAccess = { kind: "none" };

  if (token && entrySection?.visibility === "internal-entry") {
    contentAccess = await Effect.runPromise(
      readTryoutContentAccess(token, {
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

  if (contentAccess.kind === "filesystem" && contentAccess.questions) {
    const questionContent = await loadFilesystemQuestions({
      locale,
      questions: page.entryQuestions,
    });

    if (!questionContent) {
      notFound();
    }

    questions = questionContent;
  }

  if (contentAccess.kind === "filesystem" && contentAccess.answers) {
    const answerContent = await loadFilesystemAnswers({
      locale,
      questions: page.entryQuestions,
    });

    if (!answerContent) {
      notFound();
    }

    answers = answerContent;
  }

  if (contentAccess.kind === "signed") {
    [questions, answers] = await Promise.all([
      loadSignedQuestions(contentAccess.questions),
      loadSignedAnswers(contentAccess.answers),
    ]);
  }

  return (
    <TryoutSetPageClient
      content={{ entryAnswers: answers, entryQuestions: questions }}
      page={page}
      route={{ country, exam, locale, set, track }}
    />
  );
}
