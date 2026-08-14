import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { QuranTafsirLocaleSchema } from "@nakafa/aksara-contracts/quran/spec";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Runtime validator for every application locale supported by Quran reads. */
export const quranAppLocaleValidator = literals(...APP_LOCALE_CODES);

/** Runtime validator for app locales with a complete signed tafsir source. */
export const quranTafsirAppLocaleValidator = literals(
  ...QuranTafsirLocaleSchema.literals
);

/** Shared active-source fields returned by every signed Quran read. */
export const quranSourceFields = {
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  snapshotId: v.union(v.string(), v.null()),
  sourceRevision: v.union(v.string(), v.null()),
};
