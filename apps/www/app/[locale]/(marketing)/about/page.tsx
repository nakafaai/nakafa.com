import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Community } from "@/components/about/community";
import { Curriculum } from "@/components/about/curriculum";
import { Footer } from "@/components/about/footer";
import { Hero } from "@/components/about/hero";

export const revalidate = false;

type Props = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });

  return {
    title: {
      absolute: t("meta-title"),
    },
    description: t("description"),
    alternates: {
      canonical: `/${locale}/about`,
    },
  };
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <main
      className="relative mx-auto grid max-w-5xl gap-24 px-6 py-16 sm:gap-32"
      data-pagefind-ignore
    >
      <Hero />
      <Curriculum />
      <Community />
      <Footer />
    </main>
  );
}
