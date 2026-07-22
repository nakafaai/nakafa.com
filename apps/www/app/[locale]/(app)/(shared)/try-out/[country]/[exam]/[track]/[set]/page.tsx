import { Effect } from "effect";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { readTryoutSetPage } from "@/components/tryout/catalog/server";
import { readTryoutContentAccess } from "@/components/tryout/content/access";
import {
  loadTryoutAnswerContent,
  loadTryoutQuestionContent,
  type TryoutAnswerContent,
  type TryoutQuestionContent,
} from "@/components/tryout/content/load";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutSetPageClient } from "@/components/tryout/set/client";
import { TryoutPageLoading } from "@/components/tryout/shell/loading";
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
    <Suspense fallback={<TryoutPageLoading kind="route" />}>
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
  let contentAccess = { answers: false, questions: false };

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

  if (contentAccess.questions) {
    const questionContent = await loadTryoutQuestionContent({
      locale,
      questions: page.entryQuestions,
    });

    if (!questionContent) {
      notFound();
    }

    questions = questionContent;
  }

  if (contentAccess.answers) {
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
