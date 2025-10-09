import { askSeo } from "@repo/seo/ask";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { AskCta } from "@/components/ask/cta";
import { AskListItems } from "@/components/ask/results";
import {
  LayoutMaterial,
  LayoutMaterialContent,
  LayoutMaterialFooter,
  LayoutMaterialMain,
} from "@/components/shared/layout-material";
import { RefContent } from "@/components/shared/ref-content";
import { getGithubUrl } from "@/lib/utils/github";
import { convertSlugToTitle } from "@/lib/utils/helper";

export const revalidate = false;

const askData = askSeo();

type Props = {
  params: Promise<{
    locale: Locale;
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale, slug } = await params;

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

export default async function Page({ params }: Props) {
  const { locale, slug } = await params;

  const seoData = askData.find((data) => data.slug === slug);

  const title = seoData?.locales[locale].title ?? convertSlugToTitle(slug);
  const description = seoData?.locales[locale].description ?? "";

  return (
    <div data-pagefind-ignore>
      <LayoutMaterial>
        <LayoutMaterialContent>
          <div className="relative py-20">
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6">
              <h1 className="text-balance text-center font-medium text-3xl leading-tight tracking-tight">
                {title}
              </h1>

              {description && (
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

          <LayoutMaterialFooter>
            <RefContent
              githubUrl={getGithubUrl({
                path: encodeURI("/app/[locale]/ask/[slug]"),
              })}
            />
          </LayoutMaterialFooter>
        </LayoutMaterialContent>
      </LayoutMaterial>
    </div>
  );
}
