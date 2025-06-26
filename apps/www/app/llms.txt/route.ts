import { getContents } from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";

export const revalidate = false;

export async function GET() {
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

  return new Response(scanned.join("\n\n"));
}
