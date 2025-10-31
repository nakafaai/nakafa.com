import {
  getContent,
  getContents,
  getFolderChildNames,
  getNestedSlugs,
} from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import { type NextRequest, NextResponse } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import { getRawGithubUrl } from "@/lib/utils/github";

export const revalidate = false;

async function getAllContentsResponse() {
  const locales = routing.locales;
  const scanned: string[] = [];
  scanned.push("# Nakafa Content");

  // Fetch all articles and subjects for all locales in parallel
  const contentPromises = locales.flatMap((locale) => [
    getContents({ locale, basePath: "articles" }).then((contents) => ({
      section: "Articles",
      locale,
      contents,
    })),
    getContents({ locale, basePath: "subject" }).then((contents) => ({
      section: "Subjects",
      locale,
      contents,
    })),
  ]);

  const results = await Promise.all(contentPromises);

  // Group results by section
  const map = new Map<string, string[]>();

  for (const result of results) {
    for (const content of result.contents) {
      const entry = `- [${content.metadata.title}](${content.url}): ${
        content.metadata.description ?? content.metadata.title
      }`;

      const list = map.get(result.section) ?? [];
      list.push(entry);
      map.set(result.section, list);
    }
  }

  // Build final output
  for (const [key, value] of map) {
    scanned.push(`## ${key}`);
    scanned.push(value.join("\n"));
  }

  return scanned.join("\n\n");
}

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

  const content = await getContent(locale as Locale, cleanSlug);

  if (!content) {
    const allContents = await getAllContentsResponse();
    return new NextResponse(allContents);
  }

  // Construct the header information
  const urlPath = `/${locale}/${cleanSlug}`;
  const githubSourcePath = `/packages/contents/${cleanSlug}/${locale}.mdx`;

  scanned.push("# Nakafa Framework: LLM");
  scanned.push("");
  scanned.push(`URL: ${urlPath}`);
  scanned.push(`Source: ${getRawGithubUrl(githubSourcePath)}`);
  scanned.push("");
  scanned.push("Output docs content for large language models.");
  scanned.push("");
  scanned.push("---");
  scanned.push("");
  scanned.push(content.raw);

  return new NextResponse(scanned.join("\n"));
}

export function generateStaticParams() {
  // Top level directories in contents
  const topDirs = getFolderChildNames(".");
  const result: { slug: string[] }[] = [];
  const locales = routing.locales;

  // For each locale
  for (const locale of locales) {
    result.push({
      slug: [locale],
    });

    // For each top directory (articles, subject, etc)
    for (const topDir of topDirs) {
      // Get all nested paths starting from this folder
      const nestedPaths = getNestedSlugs(topDir);

      // Add the top-level folder itself
      result.push({
        slug: [locale, topDir],
      });

      // Add each nested path
      for (const path of nestedPaths) {
        result.push({
          slug: [locale, topDir, ...path],
        });
      }
    }
  }

  return result;
}
