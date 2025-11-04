import { readFile } from "node:fs/promises";
import { getFolderChildNames, getNestedSlugs } from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import { getMetadataFromSlug } from "@/lib/utils/system";
import { generateOGImage } from "./og";

export const revalidate = false;

// Load fonts at module level (once at build time)
const fontRegular = readFile(
  `${process.cwd()}/public/fonts/GeistMono-Regular.ttf`
);
const fontBold = readFile(`${process.cwd()}/public/fonts/GeistMono-Bold.ttf`);

export function generateStaticParams() {
  // Top level directories in contents
  const topDirs = getFolderChildNames(".");
  const result: { locale: string; slug: string[] }[] = [];
  const locales = routing.locales;

  // For each locale
  for (const locale of locales) {
    // Add both with and without image.png
    result.push({ locale, slug: ["image.png"] });

    // For each top directory (articles, subject, etc)
    for (const topDir of topDirs) {
      // Get all nested paths starting from this folder
      const nestedPaths = getNestedSlugs(topDir);

      // Add the top-level folder itself (with and without image.png)
      result.push(
        { locale, slug: [topDir] },
        { locale, slug: [topDir, "image.png"] }
      );

      // Add each nested path (with and without image.png)
      for (const path of nestedPaths) {
        result.push(
          { locale, slug: [topDir, ...path] },
          { locale, slug: [topDir, ...path, "image.png"] }
        );
      }
    }
  }

  return result;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string; slug: string[] }> }
) {
  const { locale, slug } = await params;

  // If last element is "image.png", remove it
  // The rest of the path is the content path
  const contentSlug = slug.at(-1) === "image.png" ? slug.slice(0, -1) : slug;

  // Get metadata from the content path
  const { title, description } = await getMetadataFromSlug(locale, contentSlug);

  return generateOGImage({
    title,
    description,
    fonts: [
      {
        name: "GeistMono",
        data: await fontRegular,
        weight: 400,
      },
      {
        name: "GeistMono",
        data: await fontBold,
        weight: 600,
      },
    ],
  });
}
