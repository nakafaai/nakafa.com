import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { FooterContent } from "@/components/shared/footer-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { RefContent } from "@/components/shared/ref-content";
import { TryoutCountryPageClient } from "@/components/tryout/catalog/country.client";
import { TryoutCountrySelector } from "@/components/tryout/catalog/selector.client";
import { readTryoutCountryPage } from "@/components/tryout/catalog/server";
import { readStaticTryoutCountryOptions } from "@/components/tryout/catalog/static";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutHeader } from "@/components/tryout/shell/chrome";
import { TryoutPageLoading } from "@/components/tryout/shell/loading";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";

export const unstable_instant = {
  prefetch: "runtime",
  samples: [{ params: { country: "indonesia", locale: "id" } }],
};

/** Renders active exam families for one try-out country. */
export default function Page(props: {
  params: Promise<{ country: string; locale: string }>;
}) {
  return (
    <Suspense fallback={<TryoutPageLoading kind="route" />}>
      <TryoutCountryRoute params={props.params} />
    </Suspense>
  );
}

/** Resolves one cached public country inside its route-owned boundary. */
async function TryoutCountryRoute({
  params,
}: {
  params: Promise<{ country: string; locale: string }>;
}) {
  const { country, locale: localeParam } = await params;
  const locale = getLocaleOrThrow(localeParam);
  const countryPath = getTryoutHref({ country }).slice(1);

  const page = await readTryoutCountryPage(locale, countryPath);

  if (!page) {
    notFound();
  }

  const [tCommon, tTryouts] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Tryouts" }),
  ]);
  const countryOptions = readStaticTryoutCountryOptions(locale);

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <TryoutHeader
          value={{
            action:
              countryOptions.length > 0 ? (
                <TryoutCountrySelector
                  currentValue={countryPath}
                  label={tTryouts("country-selector-label")}
                  options={countryOptions}
                />
              ) : undefined,
            homeLabel: tCommon("home"),
            items: [{ label: tCommon("try-out") }],
            title: tCommon("try-out"),
          }}
        />
        <LayoutContent>
          <TryoutCountryPageClient page={page} />
        </LayoutContent>
        <FooterContent>
          <RefContent
            githubUrl={getGithubUrl({
              path: `/packages/contents/tryout/${country}`,
            })}
          />
        </FooterContent>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
