import { Effect } from "effect";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { readTryoutSetPage } from "@/components/tryout/catalog/server";
import {
  loadTryoutAnswerContent,
  loadTryoutQuestionContent,
  type TryoutAnswerContent,
} from "@/components/tryout/content/load";
import { canReadTryoutAnswers } from "@/components/tryout/content/review";
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

  const questionsPromise = loadTryoutQuestionContent({
    locale,
    questions: page.entryQuestions,
  });
  const entrySection = page.entrySection;
  let canReview = false;

  if (token && entrySection?.visibility === "internal-entry") {
    canReview = await Effect.runPromise(
      canReadTryoutAnswers(token, {
        countryKey: page.set.countryKey,
        examKey: page.set.examKey,
        locale,
        sectionKey: entrySection.sectionKey,
        setKey: page.set.setKey,
        trackKey: page.set.trackKey,
      })
    );
  }

  const questions = await questionsPromise;

  if (!questions) {
    notFound();
  }

  let answers: readonly TryoutAnswerContent[] = [];

  if (canReview) {
    const answerContent = await loadTryoutAnswerContent({
      locale,
      questions: page.entryQuestions,
    });

    if (!answerContent) {
      notFound();
    }

    answers = answerContent;
  }

  return (
    <TryoutSetPageClient
      content={{ entryAnswers: answers, entryQuestions: questions }}
      page={page}
      route={{ country, exam, locale, set, track }}
    />
  );
}
