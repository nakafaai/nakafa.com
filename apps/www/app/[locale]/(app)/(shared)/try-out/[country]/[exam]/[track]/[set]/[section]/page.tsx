import { Effect } from "effect";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { readTryoutSectionPage } from "@/components/tryout/catalog/server";
import {
  loadTryoutAnswerContent,
  loadTryoutQuestionContent,
  type TryoutAnswerContent,
} from "@/components/tryout/content/load";
import { canReadTryoutAnswers } from "@/components/tryout/content/review";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutSectionPageClient } from "@/components/tryout/section/client";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export const unstable_instant = {
  prefetch: "runtime",
  samples: [
    {
      params: {
        country: "indonesia",
        exam: "snbt",
        locale: "id",
        section: "pengetahuan-kuantitatif",
        set: "set-1",
        track: "2027",
      },
    },
  ],
};

/** Renders one try-out section with public metadata and owned runtime content. */
export default function Page(props: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    section: string;
    set: string;
    track: string;
  }>;
}) {
  return (
    <Suspense fallback={null}>
      <TryoutSectionRoute params={props.params} />
    </Suspense>
  );
}

/** Resolves one cached public section inside its route-owned boundary. */
async function TryoutSectionRoute({
  params,
}: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    section: string;
    set: string;
    track: string;
  }>;
}) {
  const {
    country,
    exam,
    locale: localeParam,
    section,
    set,
    track,
  } = await params;
  const locale = getLocaleOrThrow(localeParam);
  const sectionPath = getTryoutHref({
    country,
    exam,
    section,
    set,
    track,
  }).slice(1);
  const [page, token] = await Promise.all([
    readTryoutSectionPage(locale, sectionPath),
    getToken(),
  ]);

  if (!page) {
    notFound();
  }

  const questionsPromise = loadTryoutQuestionContent({
    locale,
    questions: page.questions,
  });
  let canReview = false;

  if (token) {
    canReview = await Effect.runPromise(
      canReadTryoutAnswers(token, {
        countryKey: page.set.countryKey,
        examKey: page.set.examKey,
        locale,
        sectionKey: page.section.sectionKey,
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
      questions: page.questions,
    });

    if (!answerContent) {
      notFound();
    }

    answers = answerContent;
  }

  return (
    <TryoutSectionPageClient
      content={{ answers, questions }}
      page={page}
      route={{ country, exam, locale, section, set, track }}
    />
  );
}
