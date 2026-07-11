import { notFound } from "next/navigation";
import { Suspense } from "react";
import { readTryoutSectionPage } from "@/components/tryout/catalog/server";
import { loadTryoutQuestionContent } from "@/components/tryout/content/load";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutSectionPageClient } from "@/components/tryout/section/client";
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
  const page = await readTryoutSectionPage(locale, sectionPath);

  if (!page) {
    notFound();
  }

  const questions = await loadTryoutQuestionContent({
    locale,
    questions: page.questions,
  });

  if (!questions) {
    notFound();
  }

  return (
    <TryoutSectionPageClient
      content={{ questions }}
      page={page}
      route={{ country, exam, locale, section, set, track }}
    />
  );
}
