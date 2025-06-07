import { routing } from "@/i18n/routing";
import { getRawGithubUrl } from "@/lib/utils/github";
import { getRawContent } from "@/lib/utils/markdown";
import { getStaticParams } from "@/lib/utils/system";
import type { Article, Subject } from "@/types/llms";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { type NextRequest, NextResponse } from "next/server";

export const revalidate = false;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const slug = (await params).slug;
  const scanned: string[] = [];

  // get the locale from slug
  let locale: string;
  let cleanSlug: string;

  if (hasLocale(routing.locales, slug[0])) {
    locale = slug[0];
    cleanSlug = slug.slice(1).join("/");
  } else {
    locale = routing.defaultLocale;
    cleanSlug = slug.join("/");
  }

  const content = await getRawContent(`${cleanSlug}/${locale}.mdx`);

  if (!content) {
    notFound();
  }

  // Construct the header information
  const urlPath = `/${locale}/${cleanSlug}`;
  const githubSourcePath = `/contents/${cleanSlug}/${locale}.mdx`;

  scanned.push("# Nakafa Framework: LLM");
  scanned.push("");
  scanned.push(`URL: ${urlPath}`);
  scanned.push(`Source: ${getRawGithubUrl(githubSourcePath)}`);
  scanned.push("");
  scanned.push("Output docs content for large language models.");
  scanned.push("");
  scanned.push("---");
  scanned.push("");
  scanned.push(content);

  return new NextResponse(scanned.join("\n"));
}

export function generateStaticParams() {
  const locales = routing.locales;
  const result: { slug: string[] }[] = [];

  // Get all article params
  const articles = getStaticParams({
    basePath: "contents/articles",
    paramNames: ["category", "slug"],
    slugParam: "slug",
    isDeep: true,
  }) as Article[];

  // Get all subject params
  const subjects = getStaticParams({
    basePath: "contents/subject",
    paramNames: ["category", "grade", "material", "slug"],
    slugParam: "slug",
    isDeep: true,
  }) as Subject[];

  // Generate params for articles
  for (const locale of locales) {
    for (const article of articles) {
      if (article.category && article.slug) {
        result.push({
          slug: [
            locale,
            "articles",
            String(article.category),
            String(article.slug),
          ],
        });
      }
    }
  }

  // Generate params for subjects
  for (const locale of locales) {
    for (const subject of subjects) {
      result.push({
        slug: [
          locale,
          "subject",
          String(subject.category),
          String(subject.grade),
          String(subject.material),
          ...subject.slug.map(String),
        ],
      });
    }
  }

  return result;
}
