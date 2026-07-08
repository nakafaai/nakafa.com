import { api } from "@repo/backend/convex/_generated/api";
import { preloadedQueryResult, preloadQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import {
  loadTryoutQuestionContent,
  type TryoutQuestionContent,
} from "@/components/tryout/content";
import { getTryoutHref } from "@/components/tryout/routes";
import { TryoutSetPageClient } from "@/components/tryout/set.client";
import { preloadAuthQuery } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Renders one try-out set and its section list. */
export default async function Page(props: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    set: string;
    track: string;
  }>;
}) {
  const { country, exam, locale: localeParam, set, track } = await props.params;
  const locale = getLocaleOrThrow(localeParam);
  const setPath = getTryoutHref({ country, exam, set, track }).slice(1);
  const preloaded = await preloadQuery(api.tryouts.queries.catalog.getSetPage, {
    locale,
    publicPath: setPath,
  });
  const page = preloadedQueryResult(preloaded);

  if (!page) {
    notFound();
  }

  let questions: TryoutQuestionContent[] = [];

  if (page.entrySection?.visibility === "internal-entry") {
    const runtime = await preloadAuthQuery(
      api.tryouts.queries.attempt.getSectionRuntime,
      {
        countryKey: page.set.countryKey,
        examKey: page.set.examKey,
        locale,
        sectionKey: page.entrySection.sectionKey,
        setKey: page.set.setKey,
        trackKey: page.set.trackKey,
      }
    );
    const runtimeContent = preloadedQueryResult(runtime);

    if (runtimeContent) {
      const loadedQuestions = await loadTryoutQuestionContent({
        locale,
        questions: runtimeContent.questions,
      });

      if (!loadedQuestions) {
        notFound();
      }

      questions = loadedQuestions;
    }
  }

  return (
    <TryoutSetPageClient
      country={country}
      entryQuestions={questions}
      exam={exam}
      locale={locale}
      preloaded={preloaded}
      set={set}
      track={track}
    />
  );
}
