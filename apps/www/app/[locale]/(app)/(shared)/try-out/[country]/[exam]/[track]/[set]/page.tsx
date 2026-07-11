import { notFound } from "next/navigation";
import { Suspense } from "react";
import { readTryoutSetPage } from "@/components/tryout/catalog/server";
import { loadTryoutQuestionContent } from "@/components/tryout/content/load";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutSetPageClient } from "@/components/tryout/set/client";
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

  const page = await readTryoutSetPage(locale, setPath);

  if (!page) {
    notFound();
  }

  const questions = await loadTryoutQuestionContent({
    locale,
    questions: page.entryQuestions,
  });

  if (!questions) {
    notFound();
  }

  return (
    <TryoutSetPageClient
      content={{ entryQuestions: questions }}
      page={page}
      route={{ country, exam, locale, set, track }}
    />
  );
}
