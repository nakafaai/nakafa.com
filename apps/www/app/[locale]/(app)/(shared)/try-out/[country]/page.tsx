import { getTranslations } from "next-intl/server";
import { FooterContent } from "@/components/shared/footer-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { RefContent } from "@/components/shared/ref-content";
import { TryoutHeader } from "@/components/tryout/chrome";
import { TryoutCountryPageClient } from "@/components/tryout/country.client";
import { getTryoutHref } from "@/components/tryout/routes";
import { TryoutCountrySelector } from "@/components/tryout/selector.client";
import { readStaticTryoutCountryOptions } from "@/components/tryout/static";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";

/** Renders active exam families for one try-out country. */
export default async function Page(props: {
  params: Promise<{ country: string; locale: string }>;
}) {
  const { country, locale: localeParam } = await props.params;
  const locale = getLocaleOrThrow(localeParam);
  const countryPath = getTryoutHref({ country }).slice(1);
  const [tCommon, tTryouts] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Tryouts" }),
  ]);
  const countryOptions = readStaticTryoutCountryOptions(locale);

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <TryoutHeader
          action={
            countryOptions.length > 0 ? (
              <TryoutCountrySelector
                currentValue={countryPath}
                label={tTryouts("country-selector-label")}
                options={countryOptions}
              />
            ) : undefined
          }
          homeLabel={tCommon("home")}
          items={[{ label: tCommon("try-out") }]}
          title={tCommon("try-out")}
        />
        <LayoutContent>
          <TryoutCountryPageClient locale={locale} publicPath={countryPath} />
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
