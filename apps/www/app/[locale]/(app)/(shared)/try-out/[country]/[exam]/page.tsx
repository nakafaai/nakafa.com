import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { TryoutExamPageClient } from "@/components/tryout/catalog/exam.client";
import { TryoutExamSelector } from "@/components/tryout/catalog/selector.client";
import { readTryoutExamPage } from "@/components/tryout/catalog/server";
import {
  readStaticTryoutExamOptions,
  readStaticTryoutRoute,
} from "@/components/tryout/catalog/static";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutHeader } from "@/components/tryout/shell/chrome";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export const unstable_instant = {
  prefetch: "runtime",
  samples: [{ params: { country: "indonesia", exam: "tka", locale: "id" } }],
};

/** Renders active try-out tracks for one country and exam family. */
export default function Page(props: {
  params: Promise<{ country: string; exam: string; locale: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <TryoutExamRoute params={props.params} />
    </Suspense>
  );
}

/** Resolves one cached public exam inside its route-owned boundary. */
async function TryoutExamRoute({
  params,
}: {
  params: Promise<{ country: string; exam: string; locale: string }>;
}) {
  const { country, exam, locale: localeParam } = await params;
  const locale = getLocaleOrThrow(localeParam);
  const countryPath = getTryoutHref({ country }).slice(1);
  const examPath = getTryoutHref({ country, exam }).slice(1);

  const page = await readTryoutExamPage(locale, examPath);

  if (!page) {
    notFound();
  }

  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const tTryouts = await getTranslations({ locale, namespace: "Tryouts" });
  const examOptions = readStaticTryoutExamOptions({
    countryPath,
    locale,
  });
  const route = readStaticTryoutRoute({
    kind: "tryout-exam",
    locale,
    publicPath: examPath,
  });

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
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
              { label: route?.title ?? exam },
            ],
            title: route?.title ?? tCommon("try-out"),
          }}
        />
        <TryoutExamPageClient page={page} />
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
