import { parseSubjectCategory } from "@repo/contents/_lib/curriculum/category";
import {
  getGradeNonNumeric,
  getGradePath,
  parseGrade,
} from "@repo/contents/_lib/curriculum/grade";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import {
  getMaterialPath,
  parseMaterial,
} from "@repo/contents/_lib/curriculum/route";
import {
  getMaterialsPagination,
  getSlugPath,
} from "@repo/contents/_lib/curriculum/slug";
import { getHeadings } from "@repo/contents/_lib/toc";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import type {
  Grade,
  Material,
  SubjectCategory,
} from "@repo/contents/_types/taxonomy";
import { slugify } from "@repo/design-system/lib/utils";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Effect, Option } from "effect";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import { ComingSoon } from "@/components/shared/coming-soon";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterialFooter } from "@/components/shared/material/footer";
import { LayoutMaterialHeader } from "@/components/shared/material/header";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialMain } from "@/components/shared/material/main";
import { LayoutMaterialPagination } from "@/components/shared/material/pagination";
import { LayoutMaterialToc } from "@/components/shared/material/toc";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { importContentModuleOrNull } from "@/lib/content/module";
import {
  getCurrentSubjectMaterial,
  getRuntimeCurriculumMaterials,
} from "@/lib/content/navigation";
import { fetchRuntimeCurriculumPage } from "@/lib/content/runtime";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";
import type { SEOContext } from "@/lib/utils/seo/types";
import { getStaticParams } from "@/lib/utils/system";

async function getResolvedParams(
  params: PageProps<"/[locale]/curriculum/[category]/[grade]/[material]/[...slug]">["params"]
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

  if (
    Option.isNone(category) ||
    Option.isNone(grade) ||
    Option.isNone(material)
  ) {
    notFound();
  }

  return {
    category: category.value,
    grade: grade.value,
    locale,
    material: material.value,
    slug,
  };
}

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/curriculum/[category]/[grade]/[material]/[...slug]">["params"];
}): Promise<Metadata> {
  const { locale, category, grade, material, slug } =
    await getResolvedParams(params);

  if (slug.length === 1) {
    redirect(getSlugPath(category, grade, material, []));
  }

  const [t, { chapter, filePath, metadata, path }] = await Promise.all([
    getTranslations("Subject"),
    getSubjectMetadataData({
      locale,
      category,
      grade,
      material,
      slug,
    }),
  ]);

  if (!metadata) {
    notFound();
  }

  const alternates = createLocalizedAlternates(path, {
    types: {
      "text/markdown": `${path}.md`,
    },
  });
  // Evidence: Use ICU-based SEO generator for type-safe, locale-aware metadata
  // Source: https://developers.google.com/search/docs/appearance/title-link
  const seoContext: SEOContext = {
    type: "material-lesson",
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
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path,
    image: getOgUrl(locale, filePath),
    type: "article",
  });

  return {
    title: { absolute: title },
    description,
    alternates,
    authors: metadata.authors,
    category: t(material),
    keywords,
    ...socialMetadata,
  };
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "material",
    paramNames: ["category", "grade", "material", "slug"],
    slugParam: "slug",
    isDeep: true,
  });
}

/** Renders a curriculum lesson after Convex confirms the published route exists. */
export default async function Page({
  params,
}: {
  params: PageProps<"/[locale]/curriculum/[category]/[grade]/[material]/[...slug]">["params"];
}) {
  const { locale, category, grade, material, slug } =
    await getResolvedParams(params);

  if (slug.length === 1) {
    redirect(getSlugPath(category, grade, material, []));
  }

  const filePath = getSlugPath(category, grade, material, slug);
  const subject = await fetchRuntimeCurriculumPage({
    locale,
    slug: filePath.slice(1),
  });

  if (!subject) {
    notFound();
  }

  const content = await importContentModuleOrNull({
    filePath,
    locale,
    source: "subject-content-module",
  });

  if (!content?.default) {
    notFound();
  }

  const Content = content.default;
  const contentMetadata = subject.metadata;

  const [tCommon, tSubject] = await Promise.all([
    getTranslations("Common"),
    getTranslations("Subject"),
  ]);
  const materialPath = getMaterialPath(category, grade, material);
  const gradeLabel = tSubject(
    Option.getOrElse(getGradeNonNumeric(grade), () => "grade"),
    { grade }
  );
  const publishedAt = Option.getOrElse(
    formatContentDateISO(contentMetadata.date),
    () => contentMetadata.date
  );
  const authorJsonLd = contentMetadata.authors.map((author) => ({
    "@type": "Person" as const,
    name: author.name,
    url: `https://nakafa.com/${locale}/contributor`,
  }));

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: tCommon("subject"), path: "/curriculum" },
          {
            name: gradeLabel,
            path: getGradePath(category, grade),
          },
          { name: tSubject(material), path: materialPath },
          { name: contentMetadata.title, path: filePath },
        ])}
      />
      <ArticleJsonLd
        author={authorJsonLd}
        datePublished={publishedAt}
        description={
          contentMetadata.description ?? contentMetadata.subject ?? ""
        }
        headline={contentMetadata.title}
        image={getOgUrl(locale, filePath)}
        url={`/${locale}${filePath}`}
      />
      <LearningResourceJsonLd
        author={authorJsonLd}
        datePublished={publishedAt}
        description={
          contentMetadata.description ?? contentMetadata.subject ?? ""
        }
        educationalLevel={gradeLabel}
        name={contentMetadata.title}
      />
      <SubjectShell
        content={subject}
        filePath={filePath}
        footer={
          <DeferredComments key={`comments:${filePath}`} slug={filePath} />
        }
        locale={locale}
        material={material}
        materialPath={materialPath}
        toolbar={
          <DeferredAiSheetOpen
            audio={{
              locale,
              slug: filePath,
              contentType: "material",
            }}
            contextTitle={contentMetadata.title}
            key={`audio:${filePath}`}
          />
        }
      >
        <Content />
      </SubjectShell>
    </>
  );
}

/** Loads the cached Convex subject row and navigation data for metadata. */
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

  applyContentRuntimeCache();

  const filePath = getSlugPath(category, grade, material, slug);
  const materialPath = getMaterialPath(category, grade, material);

  const [content, materials] = await Promise.all([
    fetchRuntimeCurriculumPage({
      locale,
      slug: filePath.slice(1),
    }),
    Effect.runPromise(getRuntimeCurriculumMaterials(materialPath, locale)),
  ]);

  const metadata = content?.metadata ?? null;
  const chapterPath = getSlugPath(category, grade, material, [
    slug.at(0) ?? "",
  ]);
  const currentMaterial = getCurrentSubjectMaterial(chapterPath, materials);
  const chapter =
    slug.length > 0 && materials.length > 0
      ? Option.match(currentMaterial.currentChapter, {
          onNone: () => undefined,
          onSome: (chapter) => chapter.title,
        })
      : undefined;

  if (content && slug.length > 0 && !chapter) {
    throw new Error(
      `Synced curriculum lesson is missing material navigation: ${filePath}`
    );
  }

  return {
    content,
    metadata,
    chapter,
    filePath,
    path: `/${locale}${filePath}`,
  };
}

type SubjectRuntimePage = NonNullable<
  Awaited<ReturnType<typeof getSubjectMetadataData>>["content"]
>;

/** Wraps the imported rich MDX subject body in the material layout. */
async function SubjectShell({
  locale,
  material,
  filePath,
  materialPath,
  content,
  children,
  footer,
  toolbar,
}: {
  locale: Locale;
  material: Material;
  filePath: string;
  materialPath: string;
  content: SubjectRuntimePage;
  children: ReactNode;
  footer: ReactNode;
  toolbar: ReactNode;
}) {
  const [tCommon, materials] = await Promise.all([
    getTranslations("Common"),
    Effect.runPromise(getRuntimeCurriculumMaterials(materialPath, locale)),
  ]);

  const { metadata } = content;
  const raw = content.body;

  const pagination = getMaterialsPagination(filePath, materials);

  const headings = getHeadings(raw);

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <LayoutMaterialHeader
          content={raw}
          icon={getMaterialIcon(material)}
          link={{
            href: `${materialPath}#${slugify(metadata.subject ?? "")}`,
            label: metadata.subject ?? "",
          }}
          slug={`/${locale}${filePath}`}
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
          path: `/packages/contents${filePath}`,
        })}
        header={{
          title: metadata.title,
          href: filePath,
          description: metadata.description ?? metadata.subject,
        }}
        showComments
      />
    </LayoutMaterial>
  );
}
