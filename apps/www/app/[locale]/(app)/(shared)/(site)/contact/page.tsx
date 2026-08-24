import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getContactPageInput } from "@/lib/content/page/contact";
import {
  getPublishedPage,
  renderPublishedPage,
} from "@/lib/content/page/published";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";

type ContactPageProps = PageProps<"/[locale]/contact">;

export async function generateMetadata({
  params,
}: ContactPageProps): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const input = await getContactPageInput(locale);
  const [page, translations] = await Promise.all([
    getPublishedPage(input),
    getTranslations({ locale, namespace: "About" }),
  ]);
  const path = `/${locale}/contact`;
  return {
    alternates: createLocalizedAlternates(path, {
      types: { "text/markdown": `${path}.md` },
    }),
    description: page.projection.metadata.description,
    title: {
      absolute: `${translations("contact")} Nakafa | ${page.projection.metadata.title}`,
    },
  };
}

/** Reuses the active reviewed company-information body at a stable alias. */
export default function ContactPage({ params }: ContactPageProps) {
  return (
    <Suspense fallback={null}>
      <ContactPageContent params={params} />
    </Suspense>
  );
}

async function ContactPageContent({
  params,
}: Pick<ContactPageProps, "params">) {
  const locale = getLocaleOrThrow((await params).locale);
  const input = await getContactPageInput(locale);
  const page = await renderPublishedPage(input);
  return <main className="mx-auto max-w-3xl px-6 py-20">{page.body}</main>;
}
