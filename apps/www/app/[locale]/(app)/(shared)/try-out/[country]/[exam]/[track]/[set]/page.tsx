import { api } from "@repo/backend/convex/_generated/api";
import { preloadedQueryResult, preloadQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { notFound } from "next/navigation";
import {
  loadTryoutQuestionContent,
  type TryoutQuestionContent,
} from "@/components/tryout/content/load";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutSetPageClient } from "@/components/tryout/set/client";
import { preloadAuthQuery } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;

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
    const runtimeArgs = {
      countryKey: page.set.countryKey,
      examKey: page.set.examKey,
      locale,
      sectionKey: page.entrySection.sectionKey,
      setKey: page.set.setKey,
      trackKey: page.set.trackKey,
    };
    const currentAttempt = await preloadAuthQuery(
      api.tryouts.queries.attempt.getCurrent,
      runtimeArgs
    );
    const currentAttemptContent = preloadedQueryResult(currentAttempt);
    const runtime = isEntrySectionRuntimeAvailable(currentAttemptContent)
      ? await preloadAuthQuery(
          api.tryouts.queries.attempt.getSectionRuntime,
          runtimeArgs
        )
      : null;
    const runtimeContent = runtime ? preloadedQueryResult(runtime) : null;

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
      content={{ entryQuestions: questions }}
      preloaded={preloaded}
      route={{ country, exam, locale, set, track }}
    />
  );
}

/** Returns true when the direct-entry set can render active or review runtime. */
function isEntrySectionRuntimeAvailable(attempt: CurrentAttempt) {
  if (!attempt) {
    return false;
  }

  if (attempt.status === "in-progress") {
    return true;
  }

  return (
    attempt.section?.status === "completed" ||
    attempt.section?.status === "expired"
  );
}
