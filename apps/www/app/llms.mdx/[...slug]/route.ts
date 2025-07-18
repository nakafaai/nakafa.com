import {
  getContent,
  getFolderChildNames,
  getNestedSlugs,
} from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { type NextRequest, NextResponse } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import { getRawGithubUrl } from "@/lib/utils/github";

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

  const content = await getContent(locale as Locale, cleanSlug);

  if (!content) {
    notFound();
  }

  // Construct the header information
  const urlPath = `/${locale}/${cleanSlug}`;
  const githubSourcePath = `packages/contents/${cleanSlug}/${locale}.mdx`;

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
