import { api } from "@repo/backend/convex/_generated/api";
import { preloadedQueryResult, preloadQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { TryoutHeader } from "@/components/tryout/chrome";
import { getTryoutHref } from "@/components/tryout/routes";
import { TryoutExamSelector } from "@/components/tryout/selector.client";
import {
  readStaticTryoutExamOptions,
  readStaticTryoutRoute,
} from "@/components/tryout/static";
import { TryoutTrackPageClient } from "@/components/tryout/track.client";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Renders active try-out sets for one exam track. */
export default async function Page(props: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    track: string;
  }>;
}) {
  const { country, exam, locale: localeParam, track } = await props.params;
  const locale = getLocaleOrThrow(localeParam);
  const countryPath = getTryoutHref({ country }).slice(1);
  const examPath = getTryoutHref({ country, exam }).slice(1);
  const trackPath = getTryoutHref({ country, exam, track }).slice(1);
  const preloaded = await preloadQuery(
    api.tryouts.queries.catalog.getTrackPage,
    {
      locale,
      publicPath: trackPath,
    }
  );
  const page = preloadedQueryResult(preloaded);

  if (!page) {
    notFound();
  }

  const [tCommon, tTryouts] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Tryouts" }),
  ]);
  const examOptions = readStaticTryoutExamOptions({
    countryPath,
    locale,
  });
  const examRoute = readStaticTryoutRoute({
    kind: "tryout-exam",
    locale,
    publicPath: examPath,
  });
  const trackRoute = readStaticTryoutRoute({
    kind: "tryout-track",
    locale,
    publicPath: trackPath,
  });

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <TryoutHeader
          action={
            <TryoutExamSelector
              currentValue={examPath}
              label={tTryouts("exam-selector-label")}
              options={examOptions}
            />
          }
          homeLabel={tCommon("home")}
          items={[
            {
              href: getTryoutHref({ country }),
              label: tCommon("try-out"),
            },
            {
              href: getTryoutHref({ country, exam }),
              label: examRoute?.title ?? exam,
            },
            { label: trackRoute?.title ?? track },
          ]}
          title={trackRoute?.title ?? tCommon("try-out")}
        />
        <TryoutTrackPageClient locale={locale} preloaded={preloaded} />
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
