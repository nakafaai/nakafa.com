import { api } from "@repo/backend/convex/_generated/api";
import { preloadedQueryResult, preloadQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { getTryoutHref } from "@/components/tryout/routes";
import { TryoutSetPageClient } from "@/components/tryout/set.client";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Renders one try-out set and its section list. */
export default async function Page(props: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    set: string;
  }>;
}) {
  const { country, exam, locale: localeParam, set } = await props.params;
  const locale = getLocaleOrThrow(localeParam);
  const setPath = getTryoutHref({ country, exam, set }).slice(1);
  const preloaded = await preloadQuery(api.tryouts.queries.catalog.getSetPage, {
    locale,
    publicPath: setPath,
  });
  const page = preloadedQueryResult(preloaded);

  if (!page) {
    notFound();
  }

  return (
    <TryoutSetPageClient
      country={country}
      exam={exam}
      locale={locale}
      preloaded={preloaded}
    />
  );
}
