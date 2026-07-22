import { Effect } from "effect";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { readTryoutSectionPage } from "@/components/tryout/catalog/server";
import { readTryoutContentAccess } from "@/components/tryout/content/access";
import {
  loadTryoutAnswerContent,
  loadTryoutQuestionContent,
  type TryoutAnswerContent,
  type TryoutQuestionContent,
} from "@/components/tryout/content/load";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutSectionPageClient } from "@/components/tryout/section/client";
import { TryoutPageLoading } from "@/components/tryout/shell/loading";
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
    <Suspense fallback={<TryoutPageLoading kind="section" />}>
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

  let contentAccess = { answers: false, questions: false };

  if (token) {
    contentAccess = await Effect.runPromise(
      readTryoutContentAccess(token, {
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

  if (contentAccess.questions) {
    const questionContent = await loadTryoutQuestionContent({
      locale,
      questions: page.questions,
    });

    if (!questionContent) {
      notFound();
    }

    questions = questionContent;
  }

  if (contentAccess.answers) {
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
