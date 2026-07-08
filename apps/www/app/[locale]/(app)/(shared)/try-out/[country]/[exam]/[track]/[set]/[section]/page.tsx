import { api } from "@repo/backend/convex/_generated/api";
import { preloadedQueryResult, preloadQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { loadTryoutQuestionContent } from "@/components/tryout/content";
import { getTryoutHref } from "@/components/tryout/routes";
import { TryoutSectionPageClient } from "@/components/tryout/section.client";
import { preloadAuthQuery } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Renders one try-out section with public metadata and owned runtime content. */
export default async function Page(props: {
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
  } = await props.params;
  const locale = getLocaleOrThrow(localeParam);
  const sectionPath = getTryoutHref({
    country,
    exam,
    section,
    set,
    track,
  }).slice(1);
  const queryArgs = {
    locale,
    publicPath: sectionPath,
  };
  const preloaded = await preloadQuery(
    api.tryouts.queries.catalog.getSectionPage,
    queryArgs
  );
  const page = preloadedQueryResult(preloaded);

  if (!page) {
    notFound();
  }

  const runtimeArgs = {
    countryKey: page.set.countryKey,
    examKey: page.set.examKey,
    locale,
    sectionKey: page.section.sectionKey,
    setKey: page.set.setKey,
    trackKey: page.set.trackKey,
  };
  const [runtime, questions] = await Promise.all([
    preloadAuthQuery(
      api.tryouts.queries.attempt.getSectionRuntime,
      runtimeArgs
    ),
    loadTryoutQuestionContent({
      locale,
      questions: page.questions,
    }),
  ]);

  if (!questions) {
    notFound();
  }

  return (
    <TryoutSectionPageClient
      country={country}
      exam={exam}
      locale={locale}
      preloaded={preloaded}
      questions={questions}
      runtime={runtime}
      section={section}
      set={set}
      track={track}
    />
  );
}
