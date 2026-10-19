import { NINA_RESPONSE_CREDITS } from "@repo/backend/confect/credits/constants";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { FAQPageJsonLd } from "@repo/seo/json-ld/faq-page";
import { Array as Arr } from "effect";
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Faq } from "@/components/marketing/about/faq/landing";
import { PricingButton } from "@/components/marketing/about/pricing/button.client";
import { PricingComparison } from "@/components/marketing/about/pricing/comparison";
import { DeferredPricingToys } from "@/components/marketing/about/pricing/deferred.client";
import { PricingCards } from "@/components/marketing/about/pricing/plans";
import { StaticPrice } from "@/components/marketing/about/pricing/price";
import { Schools } from "@/components/marketing/about/schools";
import { PRICING_CLASS_HERD } from "@/components/marketing/about/toys/herd";
import { PageField } from "@/components/marketing/shared/field.client";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { type MarketingFaqItem, pricingFaqNumbers } from "@/lib/marketing/faq";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createLocalizedAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getSocialMetadata } from "@/lib/seo/social";

/** The first part of the page: the headline above the two plans. */
function PricingPagePlans() {
  const t = useTranslations("Landing");

  return (
    <section
      aria-labelledby="pricing-heading"
      className="scroll-mt-28 px-6 pt-32 pb-20 lg:px-10 lg:pt-40 lg:pb-32"
      id="plans"
    >
      <div className="mx-auto w-full max-w-7xl">
        <h1
          className="text-balance text-center text-3xl tracking-tight sm:text-4xl"
          id="pricing-heading"
        >
          {t("prices-title")}
        </h1>
        <PricingCards
          headingLevel="h2"
          Price={StaticPrice}
          proAction={<PricingButton variant="default" />}
        />
      </div>
    </section>
  );
}

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/pricing">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "PricingPage" });
  const path = `/${locale}/pricing`;
  const title = t("metadata-title");
  const description = t("metadata-description");

  return {
    title: { absolute: title },
    description,
    alternates: createLocalizedAlternates(path),
    ...getSocialMetadata({
      title,
      description,
      locale,
      path,
      image: getAppSocialArtwork({
        key: "pricing",
        locale,
        publicPath: "pricing",
      }),
    }),
  };
}

export default async function Page() {
  const locale = getLocaleOrThrow(await rootLocale());
  const [tCommon, tPricingPage] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "PricingPage" }),
  ]);
  const faqItems: MarketingFaqItem[] = Arr.map(pricingFaqNumbers, (number) => ({
    answer: tPricingPage(`a${number}`, { cost: NINA_RESPONSE_CREDITS }),
    question: tPricingPage(`q${number}`),
  }));
  const url = `${COMPANY_IDENTITY.url}/${locale}/pricing`;

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: tPricingPage("breadcrumb"), path: "/pricing" },
        ])}
      />
      <FAQPageJsonLd
        inLanguage={locale}
        mainEntity={Arr.map(faqItems, (item) => ({
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        }))}
        url={url}
      />
      <PageField />
      <div className="relative grid">
        <PricingPagePlans />
        <DeferredPricingToys />
        <PricingComparison />
        <Schools herd={PRICING_CLASS_HERD} />
        <Faq faqs={faqItems} />
      </div>
    </>
  );
}
