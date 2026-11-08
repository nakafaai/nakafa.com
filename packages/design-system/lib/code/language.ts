import { type BundledLanguage, bundledLanguages } from "shiki/langs";

/** Tells whether Shiki bundles a grammar under this exact language name. */
export function isBundledLanguage(
  language: string
): language is BundledLanguage {
  return Object.hasOwn(bundledLanguages, language);
}
