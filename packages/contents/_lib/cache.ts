import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routing } from "@repo/internationalization/src/routing";
import { Option } from "effect";
import type { Locale } from "next-intl";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contentsDir = path.join(__dirname, "..");
const MDX_EXTENSION = ".mdx";

type FilePath = string;
type LocaleCache = Set<FilePath>;
type MDXCache = Map<Locale, LocaleCache>;

interface MDXCacheConfig {
  exerciseSubdirectories: string[];
  ignoreDirPrefixes: string[];
  mdxExtension: string;
  rootDir: string;
}

class MDXCacheRegistry {
  private cache: MDXCache | null = null;
  private readonly config: MDXCacheConfig;
  private isBuilding = false;

  constructor(config?: Partial<MDXCacheConfig>) {
    this.config = {
      rootDir: contentsDir,
      mdxExtension: MDX_EXTENSION,
      ignoreDirPrefixes: ["_", ".", "node_modules", "coverage"],
      exerciseSubdirectories: ["_question", "_answer"],
      ...config,
    };
  }

  build(): MDXCache {
    if (this.cache !== null) {
      return this.cache;
    }

    if (this.isBuilding) {
      throw new Error(
        "Cache is already being built. This indicates a circular dependency or concurrent build attempt."
      );
    }

    this.isBuilding = true;

    try {
      this.cache = this.buildCacheIteratively();
      return this.cache;
    } finally {
      this.isBuilding = false;
    }
  }

  startBuilding(): void {
    this.isBuilding = true;
  }

  stopBuilding(): void {
    this.isBuilding = false;
  }

  reset(): void {
    this.cache = null;
  }

  getCache(): MDXCache | null {
    return this.cache;
  }

  getSlugsForLocale(locale: Locale): FilePath[] {
    if (this.cache === null) {
      this.build();
    }
    return Array.from(this.cache?.get(locale) ?? []);
  }

  hasLocale(locale: string): boolean {
    if (!this.isValidLocale(locale)) {
      return false;
    }
    const cache = this.cache ?? this.build();
    return cache.has(locale);
  }

  hasPath(locale: string, path: FilePath): boolean {
    if (!this.isValidLocale(locale)) {
      return false;
    }
    const cache = this.cache ?? this.build();
    const localeCache = cache.get(locale);
    return localeCache !== undefined ? localeCache.has(path) : false;
  }

  getAllLocales(): Locale[] {
    const cache = this.cache ?? this.build();
    const locales = Array.from(cache.keys());
    return locales.filter((locale) => this.isValidLocale(locale));
  }

  private buildCacheIteratively(): MDXCache {
    const cache = new Map<Locale, LocaleCache>();

    for (const locale of routing.locales) {
      cache.set(locale, new Set());
    }

    const stack: Array<{ absolutePath: string; relativePath: string }> = [
      { absolutePath: this.config.rootDir, relativePath: "" },
    ];

    for (;;) {
      const entry = stack.pop();
      if (!entry) {
        break;
      }

      const { absolutePath, relativePath } = entry;

      const entries = this.readDirectory(absolutePath);

      for (const dirEntry of entries) {
        if (dirEntry.isFile()) {
          this.addFileToCache(dirEntry.name, relativePath, cache);
        } else if (dirEntry.isDirectory()) {
          if (this.shouldIgnoreDirectory(dirEntry.name)) {
            if (this.isExerciseSubdirectory(dirEntry.name)) {
              this.processExerciseSubdirectory(
                absolutePath,
                relativePath,
                dirEntry.name,
                cache
              );
            }
          } else {
            const newAbsolutePath = path.join(absolutePath, dirEntry.name);
            const newRelativePath =
              relativePath === ""
                ? dirEntry.name
                : path.join(relativePath, dirEntry.name);

            stack.push({
              absolutePath: newAbsolutePath,
              relativePath: newRelativePath,
            });
          }
        }
      }
    }

    return cache;
  }

  private readDirectory(absolutePath: string): fs.Dirent[] {
    try {
      return fs.readdirSync(absolutePath, { withFileTypes: true });
    } catch {
      return [];
    }
  }

  private addFileToCache(
    fileName: string,
    relativePath: string,
    cache: MDXCache
  ): void {
    if (!fileName.endsWith(this.config.mdxExtension)) {
      return;
    }

    const locale = this.extractLocale(fileName);
    if (Option.isNone(locale)) {
      return;
    }

    const localeValue = Option.getOrThrow(locale);
    const localeSet = cache.get(localeValue);

    if (localeSet && relativePath !== "") {
      localeSet.add(relativePath);
    }
  }

  private extractLocale(fileName: string): Option.Option<Locale> {
    const locale = fileName.slice(0, -this.config.mdxExtension.length);
    if (!this.isValidLocale(locale)) {
      return Option.none();
    }
    return Option.some(locale);
  }

  private isValidLocale(locale: string): locale is Locale {
    const localeSet = new Set<string>(routing.locales);
    return localeSet.has(locale);
  }

  private shouldIgnoreDirectory(dirName: string): boolean {
    return this.config.ignoreDirPrefixes.some((prefix) =>
      dirName.startsWith(prefix)
    );
  }

  private isExerciseSubdirectory(dirName: string): boolean {
    return this.config.exerciseSubdirectories.includes(dirName);
  }

  private processExerciseSubdirectory(
    parentAbsolutePath: string,
    parentRelativePath: string,
    subdirectoryName: string,
    cache: MDXCache
  ): void {
    const subdirectoryPath = path.join(parentAbsolutePath, subdirectoryName);
    const entries = this.readDirectory(subdirectoryPath);

    const subdirectoryRelativePath =
      parentRelativePath === ""
        ? subdirectoryName
        : path.join(parentRelativePath, subdirectoryName);

    for (const entry of entries) {
      if (entry.isFile()) {
        this.addFileToCache(entry.name, subdirectoryRelativePath, cache);
      }
    }
  }
}

const registry = new MDXCacheRegistry();

export { registry };

/**
 * Resets the MDX file cache, forcing a rebuild on the next request.
 * Useful for testing or when file system changes need to be reflected immediately.
 */
export function resetMDXFileCache(): void {
  registry.reset();
}

/**
 * Retrieves all MDX file paths (slugs) for a specific locale.
 * Automatically builds the cache if it hasn't been initialized.
 *
 * @param locale - Target locale (e.g., "en", "id")
 * @returns Array of relative file paths for the given locale
 *
 * @example
 * ```ts
 * const slugs = getMDXSlugsForLocale("en");
 * // ["articles/hello-world", "exercises/math/set-1"]
 * ```
 */
export function getMDXSlugsForLocale(locale: Locale): FilePath[] {
  return registry.getSlugsForLocale(locale);
}

/**
 * Checks if a specific locale exists in the cache.
 *
 * @param locale - Locale string to check
 * @returns True if the locale is valid and cached
 */
export function hasLocaleInCache(locale: string): boolean {
  return registry.hasLocale(locale);
}

/**
 * Checks if a specific file path exists for a given locale.
 * Efficiently verifies existence without loading the file content.
 *
 * @param locale - Target locale
 * @param path - Relative path to check (e.g., "articles/my-post")
 * @returns True if the path exists in the cache for the locale
 *
 * @example
 * ```ts
 * if (hasPathInCache("en", "articles/my-post")) {
 *   // Safe to load content
 * }
 * ```
 */
export function hasPathInCache(locale: string, path: FilePath): boolean {
  return registry.hasPath(locale, path);
}

/**
 * Retrieves all locales currently stored in the cache.
 *
 * @returns Array of available locale strings
 */
export function getAllCachedLocales(): Locale[] {
  return registry.getAllLocales();
}

/**
 * Retrieves the raw underlying cache map.
 * Use with caution; prefer using specific getter functions.
 *
 * @returns The Map<Locale, Set<FilePath>> or null if not built
 */
export function getMDXFileCache(): MDXCache | null {
  return registry.getCache();
}
