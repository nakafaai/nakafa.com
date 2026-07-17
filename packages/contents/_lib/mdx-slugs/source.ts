import path from "node:path";
import { readContentDirectoryPaths } from "@repo/contents/_lib/fs/folder-scan";
import { resolveContentsDir } from "@repo/contents/_lib/root";
import { MdxLocaleParityError } from "@repo/contents/_shared/error";
import {
  CONTENT_ROOT_VALUES,
  type Locale,
} from "@repo/contents/_types/content";
import { defaultLocale, locales } from "@repo/utilities/locales";
import { Effect } from "effect";

const contentsDir = resolveContentsDir(import.meta.url);
const mdxExtension = ".mdx";
const contentScanRoots = [
  CONTENT_ROOT_VALUES.articles,
  CONTENT_ROOT_VALUES.material,
] as const;

type MdxSlugManifest = Readonly<Record<Locale, readonly string[]>>;

/** Reads all localized MDX slugs in one content-tree traversal. */
export const readMdxSlugManifest = Effect.fn("contents.mdxSlugs.readManifest")(
  function* () {
    const slugsByLocale = createMdxSlugBuckets();

    for (const root of contentScanRoots) {
      const filePaths = yield* readContentDirectoryPaths(
        path.join(contentsDir, root)
      );

      for (const filePath of filePaths) {
        addLocalizedMdxPath(root, filePath, slugsByLocale);
      }
    }

    const manifest = sortMdxSlugBuckets(slugsByLocale);

    yield* validateMdxSlugParity(manifest);
    return manifest;
  }
);

/** Creates mutable slug buckets for every supported routing locale. */
function createMdxSlugBuckets() {
  return {
    en: new Set<string>(),
    id: new Set<string>(),
  };
}

/** Converts mutable slug buckets into the sorted locale parity manifest. */
function sortMdxSlugBuckets(slugsByLocale: Record<Locale, Set<string>>) {
  return {
    en: Array.from(slugsByLocale.en).sort(),
    id: Array.from(slugsByLocale.id).sort(),
  };
}

/** Rejects locale corpora that do not own the same MDX source paths. */
const validateMdxSlugParity = Effect.fn("contents.mdxSlugs.validateParity")(
  function* (manifest: MdxSlugManifest) {
    const referenceSlugs = manifest[defaultLocale];
    const referenceSlugSet = new Set(referenceSlugs);

    for (const locale of locales) {
      if (locale === defaultLocale) {
        continue;
      }

      const localizedSlugs = manifest[locale];
      const localizedSlugSet = new Set(localizedSlugs);
      const missingSlugs = referenceSlugs.filter(
        (slug) => !localizedSlugSet.has(slug)
      );
      const unexpectedSlugs = localizedSlugs.filter(
        (slug) => !referenceSlugSet.has(slug)
      );

      if (missingSlugs.length === 0 && unexpectedSlugs.length === 0) {
        continue;
      }

      return yield* Effect.fail(
        new MdxLocaleParityError({
          locale,
          message: `MDX paths for ${locale} do not match ${defaultLocale}.`,
          missingSlugs,
          unexpectedSlugs,
        })
      );
    }
  }
);

/** Adds locale-matching recursive MDX paths to the slug set. */
function addLocalizedMdxPath(
  root: (typeof contentScanRoots)[number],
  filePath: string,
  slugsByLocale: Record<Locale, Set<string>>
) {
  if (!isLocalizedMdxPath(filePath)) {
    return;
  }

  const locale = getLocalizedMdxLocale(filePath);
  if (!locale) {
    return;
  }

  const slugs = slugsByLocale[locale];

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
  const locale = basename.slice(basename.lastIndexOf(".") + 1);

  return locales.find((contentLocale) => contentLocale === locale);
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
function isLocalizedMdxPath(filePath: string) {
  return filePath.endsWith(mdxExtension);
}
