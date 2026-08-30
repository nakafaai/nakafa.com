import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { FAQPageJsonLd } from "@repo/seo/json-ld/faq-page";
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { PricingPageFaq } from "@/components/marketing/about/faq/pricing";
import type { MarketingFaqItem } from "@/components/marketing/about/faq/section";
import { PricingPagePlans } from "@/components/marketing/about/pricing/plans";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createLocalizedAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getSocialMetadata } from "@/lib/utils/metadata";

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
      image: "/og.png",
    }),
  };
}

export default async function Page() {
  const locale = getLocaleOrThrow(await rootLocale());
  const [tCommon, tPricingPage] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "PricingPage" }),
  ]);
  const faqItems: MarketingFaqItem[] = [
    { question: tPricingPage("q1"), answer: tPricingPage("a1") },
    { question: tPricingPage("q2"), answer: tPricingPage("a2") },
    { question: tPricingPage("q3"), answer: tPricingPage("a3") },
    { question: tPricingPage("q4"), answer: tPricingPage("a4") },
    { question: tPricingPage("q5"), answer: tPricingPage("a5") },
    { question: tPricingPage("q6"), answer: tPricingPage("a6") },
    { question: tPricingPage("q7"), answer: tPricingPage("a7") },
    { question: tPricingPage("q8"), answer: tPricingPage("a8") },
    { question: tPricingPage("q9"), answer: tPricingPage("a9") },
    { question: tPricingPage("q10"), answer: tPricingPage("a10") },
    { question: tPricingPage("q11"), answer: tPricingPage("a11") },
    { question: tPricingPage("q12"), answer: tPricingPage("a12") },
    { question: tPricingPage("q13"), answer: tPricingPage("a13") },
    { question: tPricingPage("q14"), answer: tPricingPage("a14") },
    { question: tPricingPage("q15"), answer: tPricingPage("a15") },
    { question: tPricingPage("q16"), answer: tPricingPage("a16") },
    { question: tPricingPage("q17"), answer: tPricingPage("a17") },
    { question: tPricingPage("q18"), answer: tPricingPage("a18") },
    { question: tPricingPage("q19"), answer: tPricingPage("a19") },
    { question: tPricingPage("q20"), answer: tPricingPage("a20") },
  ];
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
