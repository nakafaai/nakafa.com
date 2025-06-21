import { getMetadataFromSlug } from "@/lib/utils/system";
import { getFolderChildNames, getNestedSlugs } from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import { generateOGImage } from "./og";

export function generateStaticParams() {
  // Top level directories in contents
  const topDirs = getFolderChildNames(".");
  const result: { locale: string; slug: string[] }[] = [];
  const locales = routing.locales;

  // For each locale
  for (const locale of locales) {
    // For each top directory (articles, subject, etc)
    for (const topDir of topDirs) {
      // Get all nested paths starting from this folder
      const nestedPaths = getNestedSlugs(topDir);

      // Add the top-level folder itself
      result.push({
        locale,
        slug: [topDir, "image.png"],
      });

      // Add each nested path
      for (const path of nestedPaths) {
        result.push({
          locale,
          slug: [topDir, ...path, "image.png"],
        });
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

  // Fetch fonts from public directory
  const fontData = await fetch(
    new URL("/fonts/GeistMono-Regular.ttf", _req.url)
  ).then((res) => res.arrayBuffer());
  const fontBoldData = await fetch(
    new URL("/fonts/GeistMono-Bold.ttf", _req.url)
  ).then((res) => res.arrayBuffer());

  return generateOGImage({
    title,
    description,
    fonts: [
      {
        name: "GeistMono",
        data: fontData,
        weight: 400,
      },
      {
        name: "GeistMono",
        data: fontBoldData,
        weight: 600,
      },
    ],
  });
}
