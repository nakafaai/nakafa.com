import { BookOpen02Icon } from "@hugeicons/core-free-icons";
import { getCategoryPath } from "@repo/contents/_lib/articles/category";
import { getCategoryIcon } from "@repo/contents/_lib/articles/icons";
import { ARTICLE_CATEGORIES } from "@repo/contents/_types/taxonomy";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { use } from "react";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { SubjectItem } from "@/components/shared/subject-item";
import { SubjectList } from "@/components/shared/subject-list";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

/** Builds locale-specific article index metadata from the article namespace copy. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/articles">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const [tCommon, tArticles] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Articles" }),
  ]);

  const path = `/${locale}/articles`;
  const title = tCommon("articles");
  const description = tArticles("description");
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path,
    image: getOgUrl(locale, "/articles"),
  });

  return {
    title,
    description,
    alternates: createLocalizedAlternates(path),
    ...socialMetadata,
  };
}

/** Adapts the localized Next route params to the article index surface. */
export default function Page(props: PageProps<"/[locale]/articles">) {
  const { locale: rawLocale } = use(props.params);
  const locale = getLocaleOrThrow(rawLocale);

  return <PageContent locale={locale} />;
}

/** Renders the category chooser with the established subject-list row pattern. */
async function PageContent({ locale }: { locale: Locale }) {
  const [tCommon, tArticles] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Articles" }),
  ]);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: tCommon("articles"), path: "/articles" },
        ])}
      />
      <HeaderContent
        description={tArticles("description")}
        icon={BookOpen02Icon}
        title={tCommon("articles")}
      />
      <LayoutContent>
        <SubjectList>
          {ARTICLE_CATEGORIES.map((category) => (
            <SubjectItem
              href={getCategoryPath(category)}
              icon={getCategoryIcon(category)}
              key={category}
              label={tArticles(category)}
            />
          ))}
        </SubjectList>
      </LayoutContent>
      <FooterContent className="mt-0">
        <RefContent
          githubUrl={getGithubUrl({ path: "/packages/contents/articles" })}
        />
      </FooterContent>
    </>
  );
}
