import { routing } from "@/i18n/routing";
import { getRawGithubUrl } from "@/lib/utils/github";
import { getRawContent } from "@/lib/utils/markdown";
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
