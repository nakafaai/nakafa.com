import { askSeo } from "@repo/seo/ask";
import { FAQPageJsonLd } from "@repo/seo/json-ld/faq-page";
import type { Metadata } from "next";

import { use } from "react";
import { AskCta } from "@/components/ask/cta";
import { AskListItems } from "@/components/ask/results";
import {
  LayoutMaterial,
  LayoutMaterialContent,
  LayoutMaterialMain,
} from "@/components/shared/layout-material";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { convertSlugToTitle } from "@/lib/utils/helper";

const askData = askSeo();

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/ask/[slug]">["params"];
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = getLocaleOrThrow(rawLocale);

  const seoData = askData.find((data) => data.slug === slug);

  if (!seoData) {
    return {};
  }

  const title = seoData.locales[locale].title;
  const description = seoData.locales[locale].description;

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: `/${locale}/ask/${slug}`,
    },
    keywords: title
      .split(" ")
      .concat(description.split(" "))
      .filter((keyword) => keyword.length > 0),
  };
}

export function generateStaticParams() {
  return askData.map((data) => ({
    slug: data.slug,
  }));
}

export default function Page(props: PageProps<"/[locale]/ask/[slug]">) {
  const { params } = props;
  const { locale: rawLocale, slug } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  // Enable static rendering

  const seoData = askData.find((data) => data.slug === slug);

  const title = seoData?.locales[locale].title ?? convertSlugToTitle(slug);
  const description = seoData?.locales[locale].description ?? "";

  return (
    <>
      <FAQPageJsonLd
        inLanguage={locale}
        mainEntity={[
          {
            name: title,
            acceptedAnswer: {
              "@type": "Answer",
              text: description,
            },
          },
        ]}
        url={`https://nakafa.com/${locale}/ask/${slug}`}
      />
      <div data-pagefind-ignore>
        <LayoutMaterial>
          <LayoutMaterialContent>
            <div className="relative py-20">
              <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6">
                <h1 className="text-balance text-center font-medium text-3xl leading-tight tracking-tight">
                  {title}
                </h1>

                {!!description && (
                  <p className="text-balance text-center text-muted-foreground">
                    {description}
                  </p>
                )}

                <AskCta title={title} />
              </div>
            </div>

            <LayoutMaterialMain>
              <AskListItems query={title} />
            </LayoutMaterialMain>
          </LayoutMaterialContent>
        </LayoutMaterial>
      </div>
    </>
  );
}
