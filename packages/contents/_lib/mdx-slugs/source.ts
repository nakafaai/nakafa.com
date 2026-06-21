import path from "node:path";
import { readContentDirectoryPaths } from "@repo/contents/_lib/fs/folder-scan";
import { resolveContentsDir } from "@repo/contents/_lib/root";
import { CONTENT_ROOT_VALUES } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";

const contentsDir = resolveContentsDir(import.meta.url);
const mdxExtension = ".mdx";
const contentScanRoots = [
  CONTENT_ROOT_VALUES.articles,
  CONTENT_ROOT_VALUES.material,
] as const;

export type MdxSlugManifest = ReadonlyMap<string, readonly string[]>;

/** Returns whether an unchecked locale can own localized MDX content. */
export function isMdxContentLocale(locale: string) {
  return routing.locales.some((contentLocale) => contentLocale === locale);
}

/** Reads all localized MDX slugs in one content-tree traversal. */
export const readMdxSlugManifest = Effect.fn("contents.mdxSlugs.readManifest")(
  function* () {
    const slugsByLocale = createMdxSlugBuckets();

    for (const root of contentScanRoots) {
      const filePaths = yield* readContentRootPaths(root);

      for (const filePath of filePaths) {
        addLocalizedMdxPath(root, filePath, slugsByLocale);
      }
    }

    return sortMdxSlugBuckets(slugsByLocale);
  }
);

/** Copies one locale's slugs without exposing cached manifest arrays. */
export function getMdxSlugsFromManifest(
  manifest: MdxSlugManifest,
  locale: string
) {
  const slugs = manifest.get(locale);

  if (!slugs) {
    return [];
  }

  return [...slugs];
}

/** Creates mutable slug buckets for every supported routing locale. */
function createMdxSlugBuckets() {
  const slugsByLocale = new Map<string, Set<string>>();

  for (const locale of routing.locales) {
    slugsByLocale.set(locale, new Set());
  }

  return slugsByLocale;
}

/** Converts mutable slug buckets into sorted arrays for cache consumers. */
function sortMdxSlugBuckets(slugsByLocale: ReadonlyMap<string, Set<string>>) {
  const manifest = new Map<string, readonly string[]>();

  for (const [locale, slugs] of slugsByLocale) {
    manifest.set(locale, Array.from(slugs).sort());
  }

  return manifest;
}

/** Reads one content root recursively and treats unreadable roots as empty. */
function readContentRootPaths(root: (typeof contentScanRoots)[number]) {
  return readContentDirectoryPaths(path.join(contentsDir, root)).pipe(
    Effect.catchTag("DirectoryReadError", () => Effect.succeed([]))
  );
}

/** Adds locale-matching recursive MDX paths to the slug set. */
function addLocalizedMdxPath(
  root: (typeof contentScanRoots)[number],
  filePath: string,
  slugsByLocale: Map<string, Set<string>>
) {
  if (!isLocalizedMdxPath(root, filePath)) {
    return;
  }

  const locale = getLocalizedMdxLocale(filePath);
  const slugs = slugsByLocale.get(locale);

  if (!slugs) {
    return;
  }

  const slugPath = getLocalizedMdxSlugPath(filePath);

  if (slugPath === ".") {
    slugs.add(root);
    return;
  }

  slugs.add(`${root}/${slugPath}`);
}

/** Returns the locale suffix from `en.mdx` or typed assets like `question.en.mdx`. */
function getLocalizedMdxLocale(filePath: string) {
  const basename = path.basename(filePath, mdxExtension);

  return basename.slice(basename.lastIndexOf(".") + 1);
}

/** Converts one localized MDX file path into its locale-free content slug. */
function getLocalizedMdxSlugPath(filePath: string) {
  const parentPath = path.dirname(filePath);
  const basename = path.basename(filePath, mdxExtension);
  const basenameParts = basename.split(".");

  if (basenameParts.length === 1) {
    return parentPath;
  }

  const contentStem = basenameParts.slice(0, -1).join(".");

  if (parentPath === ".") {
    return contentStem;
  }

  return `${parentPath}/${contentStem}`;
}

/** Returns whether a recursive path is a localized MDX content file. */
function isLocalizedMdxPath(
  _root: (typeof contentScanRoots)[number],
  filePath: string
) {
  return filePath.endsWith(mdxExtension);
}
