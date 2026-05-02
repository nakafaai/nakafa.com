import { captureServerException } from "@repo/analytics/posthog/server";
import { importContentModule } from "@repo/contents/_lib/module";
import { parseSubjectCategory } from "@repo/contents/_lib/subject/category";
import {
  getGradeNonNumeric,
  parseGrade,
} from "@repo/contents/_lib/subject/grade";
import {
  getCurrentMaterial,
  getMaterialIcon,
  getMaterialPath,
  getMaterials,
  parseMaterial,
} from "@repo/contents/_lib/subject/material";
import {
  getMaterialsPagination,
  getSlugPath,
} from "@repo/contents/_lib/subject/slug";
import { getHeadings } from "@repo/contents/_lib/toc";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import { ContentMetadataSchema } from "@repo/contents/_types/content";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import type { Material } from "@repo/contents/_types/subject/material";
import { slugify } from "@repo/design-system/lib/utils";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Effect } from "effect";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import { ComingSoon } from "@/components/shared/coming-soon";
import {
  LayoutMaterial,
  LayoutMaterialContent,
  LayoutMaterialFooter,
  LayoutMaterialHeader,
  LayoutMaterialMain,
  LayoutMaterialPagination,
  LayoutMaterialToc,
} from "@/components/shared/layout-material";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import { getContentMetadataContext } from "@/lib/utils/pages/subject";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";
import type { SEOContext } from "@/lib/utils/seo/types";
import { getStaticParams } from "@/lib/utils/system";

async function getResolvedParams(
  params: PageProps<"/[locale]/subject/[category]/[grade]/[material]/[...slug]">["params"]
) {
  const {
    locale: rawLocale,
    category: rawCategory,
    grade: rawGrade,
    material: rawMaterial,
    slug,
  } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseSubjectCategory(rawCategory);
  const grade = parseGrade(rawGrade);
  const material = parseMaterial(rawMaterial);

  if (!(category && grade && material)) {
    notFound();
  }

  return { category, grade, locale, material, slug };
}

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/subject/[category]/[grade]/[material]/[...slug]">["params"];
}): Promise<Metadata> {
  const { locale, category, grade, material, slug } =
    await getResolvedParams(params);

  if (slug.length === 1) {
    redirect(getSlugPath(category, grade, material, []));
  }

  const t = await getTranslations("Subject");

  const { chapter, filePath, metadata, path } = await getSubjectMetadataData({
    locale,
    category,
    grade,
    material,
    slug,
  });

  if (!metadata) {
    notFound();
  }

  const alternates = {
    canonical: path,
    types: {
      "text/markdown": `${path}.md`,
    },
  };
  const image = {
    url: getOgUrl(locale, filePath),
    width: 1200,
    height: 630,
  };
  const twitter: Metadata["twitter"] = {
    images: [image],
  };
  const openGraph: Metadata["openGraph"] = {
    url: path,
    images: [image],
    type: "article",
    siteName: "Nakafa",
    locale,
  };

  // Evidence: Use ICU-based SEO generator for type-safe, locale-aware metadata
  // Source: https://developers.google.com/search/docs/appearance/title-link
  const seoContext: SEOContext = {
    type: "subject",
    category,
    grade,
    material,
    chapter,
    data: {
      title: metadata.title,
      description: metadata.description,
      subject: metadata.subject,
    },
  };

  const { title, description, keywords } = await generateSEOMetadata(
    seoContext,
    locale
  );

  return {
    title: { absolute: title },
    description,
    alternates,
    authors: metadata.authors,
    category: t(material),
    keywords,
    openGraph,
    twitter,
  };
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "subject",
    paramNames: ["category", "grade", "material", "slug"],
    slugParam: "slug",
    isDeep: true,
  });
}

export default async function Page({
  params,
}: {
  params: PageProps<"/[locale]/subject/[category]/[grade]/[material]/[...slug]">["params"];
}) {
  const { locale, category, grade, material, slug } =
    await getResolvedParams(params);

  if (slug.length === 1) {
    redirect(getSlugPath(category, grade, material, []));
  }

  const filePath = getSlugPath(category, grade, material, slug);
  const content = await importContentModule(filePath, locale).catch(
    async (error) => {
      await captureServerException(error, undefined, {
        file_path: filePath,
        locale,
        source: "subject-content-module",
      });

      return null;
    }
  );
  const Content = content?.default;
  if (!Content) {
    notFound();
  }

  const contentMetadata = ContentMetadataSchema.safeParse(
    content?.metadata
  ).data;

  return (
    <CachedSubjectShell
      category={category}
      footer={<DeferredComments key={`comments:${filePath}`} slug={filePath} />}
      grade={grade}
      locale={locale}
      material={material}
      slug={slug}
      toolbar={
        <DeferredAiSheetOpen
          audio={{
            locale,
            slug: filePath,
            contentType: "subject",
          }}
          contextTitle={contentMetadata?.title}
          key={`audio:${filePath}`}
        />
      }
    >
      <Content />
    </CachedSubjectShell>
  );
}

async function getSubjectMetadataData({
  locale,
  category,
  grade,
  material,
  slug,
}: {
  locale: Locale;
  category: SubjectCategory;
  grade: Grade;
  material: Material;
  slug: string[];
}) {
  "use cache";

  cacheLife("max");

  const filePath = getSlugPath(category, grade, material, slug);
  const materialPath = getMaterialPath(category, grade, material);

  const [{ content }, materials] = await Promise.all([
    Effect.runPromise(
      Effect.match(
        getContentMetadataContext({ locale, category, grade, material, slug }),
        {
          onFailure: () => ({ content: null, FilePath: filePath }),
          onSuccess: (data) => data,
        }
      )
    ),
    getMaterials(materialPath, locale).catch(async (error) => {
      await captureServerException(error, undefined, {
        locale,
        material_path: materialPath,
        source: "subject-metadata-materials",
      });

      return [];
    }),
  ]);

  const metadata = content?.metadata ?? null;
  const chapterPath = getSlugPath(category, grade, material, [
    slug.at(0) ?? "",
  ]);
  const chapter =
    slug.length > 0 && materials.length > 0
      ? getCurrentMaterial(chapterPath, materials).currentChapter?.title
      : undefined;

  return {
    metadata,
    chapter,
    filePath,
    path: `/${locale}${filePath}`,
  };
}

async function CachedSubjectShell({
  locale,
  category,
  grade,
  material,
  slug,
  children,
  footer,
  toolbar,
}: {
  locale: Locale;
  category: SubjectCategory;
  grade: Grade;
  material: Material;
  slug: string[];
  children: ReactNode;
  footer: ReactNode;
  toolbar: ReactNode;
}) {
  "use cache";

  cacheLife("max");

  const [tCommon, tSubject] = await Promise.all([
    getTranslations("Common"),
    getTranslations("Subject"),
  ]);

  const FilePath = getSlugPath(category, grade, material, slug);
  const materialPath = getMaterialPath(category, grade, material);

  const [content, materials] = await Promise.all([
    Effect.runPromise(
      Effect.match(
        getContentMetadataContext({ locale, category, grade, material, slug }),
        {
          onFailure: () => ({ content: null, FilePath }),
          onSuccess: (data) => data,
        }
      )
    ),
    getMaterials(materialPath, locale).catch(async (error) => {
      await captureServerException(error, undefined, {
        locale,
        material_path: materialPath,
        source: "subject-shell-materials",
      });

      return null;
    }),
  ]);

  if (!content.content) {
    notFound();
  }

  if (!(materials && children !== null)) {
    return (
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialMain className="py-24">
            <ComingSoon />
          </LayoutMaterialMain>
        </LayoutMaterialContent>
      </LayoutMaterial>
    );
  }

  const { metadata, raw } = content.content;
  const publishedAt = formatContentDateISO(metadata.date) ?? metadata.date;

  const pagination = getMaterialsPagination(FilePath, materials);

  const headings = getHeadings(raw);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={headings.map((heading, index) => ({
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}${FilePath}${heading.href}`,
          position: index + 1,
          name: heading.label,
          item: `https://nakafa.com/${locale}${FilePath}${heading.href}`,
        }))}
      />
      <ArticleJsonLd
        author={metadata.authors.map((author: { name: string }) => ({
          "@type": "Person",
          name: author.name,
          url: `https://nakafa.com/${locale}/contributor`,
        }))}
        datePublished={publishedAt}
        description={metadata.description ?? metadata.subject ?? ""}
        headline={metadata.title}
        image={getOgUrl(locale, FilePath)}
        url={`/${locale}${FilePath}`}
      />
      <LearningResourceJsonLd
        author={metadata.authors.map((author: { name: string }) => ({
          "@type": "Person",
          name: author.name,
          url: `https://nakafa.com/${locale}/contributor`,
        }))}
        datePublished={publishedAt}
        description={metadata.description ?? metadata.subject ?? ""}
        educationalLevel={tSubject(getGradeNonNumeric(grade) ?? "grade", {
          grade,
        })}
        name={metadata.title}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialHeader
            content={raw}
            icon={getMaterialIcon(material)}
            link={{
              href: `${materialPath}#${slugify(metadata.subject ?? "")}`,
              label: metadata.subject ?? "",
            }}
            slug={`/${locale}${FilePath}`}
            title={metadata.title}
          />
          <LayoutMaterialMain>
            {headings.length === 0 && <ComingSoon />}
            {headings.length > 0 ? children : null}
          </LayoutMaterialMain>
          <LayoutMaterialPagination pagination={pagination} />
          <LayoutMaterialFooter>{footer}</LayoutMaterialFooter>
          {toolbar}
        </LayoutMaterialContent>
        <LayoutMaterialToc
          chapters={{
            label: tCommon("on-this-page"),
            data: headings,
          }}
          githubUrl={getGithubUrl({
            path: `/packages/contents${FilePath}`,
          })}
          header={{
            title: metadata.title,
            href: FilePath,
            description: metadata.description ?? metadata.subject,
          }}
          showComments
        />
      </LayoutMaterial>
    </>
  );
}
