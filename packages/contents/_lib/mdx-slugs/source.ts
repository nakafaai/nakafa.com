import path from "node:path";
import { readContentDirectoryPaths } from "@repo/contents/_lib/fs/folder-scan";
import { resolveContentsDir } from "@repo/contents/_lib/root";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";

const contentsDir = resolveContentsDir(import.meta.url);
const mdxExtension = ".mdx";
const contentScanRoots = ["articles", "subject", "exercises"] as const;
const exerciseContentPathSegments = ["/_question/", "/_answer/"] as const;

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

  const locale = path.basename(filePath, mdxExtension);
  const slugs = slugsByLocale.get(locale);

  if (!slugs) {
    return;
  }

  const slugPath = path.dirname(filePath);

  if (slugPath === ".") {
    slugs.add(root);
    return;
  }

  slugs.add(`${root}/${slugPath}`);
}

/** Returns whether a recursive path is a localized MDX content file. */
function isLocalizedMdxPath(
  root: (typeof contentScanRoots)[number],
  filePath: string
) {
  if (!filePath.endsWith(mdxExtension)) {
    return false;
  }

  if (root !== "exercises") {
    return true;
  }

  return exerciseContentPathSegments.some((segment) =>
    filePath.includes(segment)
  );
}
