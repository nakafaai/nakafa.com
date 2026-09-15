import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { FAQPageJsonLd } from "@repo/seo/json-ld/faq-page";
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PricingPageFaq } from "@/components/marketing/about/faq/pricing";
import { PricingCards } from "@/components/marketing/about/pricing/plans";
import type { PriceProps } from "@/components/marketing/about/pricing/price";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { type MarketingFaqItem, pricingFaqNumbers } from "@/lib/marketing/faq";
import { getAppSocialArtwork } from "@/lib/og/app-artwork";
import { createLocalizedAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getSocialMetadata } from "@/lib/utils/metadata";

/** Keeps the dedicated route price static and out of the landing animation. */
function StaticPrice({ price }: PriceProps) {
  return (
    <span className="font-semibold text-4xl tracking-tight">{price.text}</span>
  );
}

/** Owns the dedicated pricing introduction and shared plan comparison. */
function PricingPagePlans() {
  const t = useTranslations("PricingPage");

  return (
    <section aria-labelledby="pricing-heading" className="border-b">
      <div className="mx-auto w-full max-w-7xl">
        <div
          className="scroll-mt-28 px-6 py-24 sm:py-28 lg:px-10 lg:py-32"
          id="pricing"
        >
          <h1
            className="max-w-3xl text-balance text-3xl tracking-tight sm:text-4xl"
            id="pricing-heading"
          >
            {t.rich("headline", {
              mark: (chunks) => <mark>{chunks}</mark>,
            })}
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            {t("description")}
          </p>
        </div>
      </div>

      <div className="border-t bg-card text-card-foreground">
        <div className="mx-auto w-full max-w-7xl border-x">
          <PricingCards headingLevel="h2" Price={StaticPrice} />
        </div>
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
  const faqItems: MarketingFaqItem[] = pricingFaqNumbers.map((number) => ({
    answer: tPricingPage(`a${number}`),
    question: tPricingPage(`q${number}`),
  }));
  const url = `https://nakafa.com/${locale}/pricing`;

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
        mainEntity={faqItems.map((item) => ({
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        }))}
        url={url}
      />
      <div className="relative grid">
        <PricingPagePlans />
        <PricingPageFaq faqs={faqItems} />
      </div>
    </>
  );
}
