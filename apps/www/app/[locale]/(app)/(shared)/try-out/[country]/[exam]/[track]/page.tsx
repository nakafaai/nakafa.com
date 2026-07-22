import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { TryoutExamSelector } from "@/components/tryout/catalog/selector.client";
import { readTryoutTrackPage } from "@/components/tryout/catalog/server";
import {
  readStaticTryoutExamOptions,
  readStaticTryoutRoute,
} from "@/components/tryout/catalog/static";
import { TryoutTrackPageClient } from "@/components/tryout/catalog/track.client";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutHeader } from "@/components/tryout/shell/chrome";
import { TryoutPageLoading } from "@/components/tryout/shell/loading";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export const unstable_instant = {
  prefetch: "runtime",
  samples: [
    {
      params: {
        country: "indonesia",
        exam: "tka",
        locale: "id",
        track: "matematika",
      },
    },
  ],
};

/** Renders active try-out sets for one exam track. */
export default function Page(props: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    track: string;
  }>;
}) {
  return (
    <Suspense fallback={<TryoutPageLoading kind="route" />}>
      <TryoutTrackRoute params={props.params} />
    </Suspense>
  );
}

/** Resolves one cached public track inside its route-owned boundary. */
async function TryoutTrackRoute({
  params,
}: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    track: string;
  }>;
}) {
  const { country, exam, locale: localeParam, track } = await params;
  const locale = getLocaleOrThrow(localeParam);
  const countryPath = getTryoutHref({ country }).slice(1);
  const examPath = getTryoutHref({ country, exam }).slice(1);
  const trackPath = getTryoutHref({ country, exam, track }).slice(1);
  const trackRoute = readStaticTryoutRoute({
    kind: "tryout-track",
    locale,
    publicPath: trackPath,
  });

  if (!trackRoute) {
    notFound();
  }

  const page = await readTryoutTrackPage(locale, trackPath);

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

  return (
    <LayoutMaterial className="h-[calc(100svh-4rem)] flex-col overflow-clip lg:h-svh">
      <LayoutMaterialContent className="flex min-h-0 flex-1 flex-col">
        <TryoutHeader
          value={{
            action: (
              <TryoutExamSelector
                currentValue={examPath}
                label={tTryouts("exam-selector-label")}
                options={examOptions}
              />
            ),
            homeLabel: tCommon("home"),
            items: [
              {
                href: getTryoutHref({ country }),
                label: tCommon("try-out"),
                menuLabel: tCommon("try-out-short"),
              },
              {
                href: getTryoutHref({ country, exam }),
                label: examRoute?.title ?? exam,
              },
              { label: trackRoute?.title ?? track },
            ],
            title: trackRoute?.title ?? tCommon("try-out"),
          }}
        />
        <TryoutTrackPageClient locale={locale} page={page} />
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
