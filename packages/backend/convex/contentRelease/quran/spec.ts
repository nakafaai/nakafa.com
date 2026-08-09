import {
  QURAN_LOCALES,
  QURAN_TAFSIR_LOCALES,
} from "@nakafa/aksara-contracts/quran/spec";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Runtime validator for every locale supported by the signed Quran source. */
export const quranLocaleValidator = literals(...QURAN_LOCALES);

/** Runtime validator for locales with a complete signed tafsir source. */
export const quranTafsirLocaleValidator = literals(...QURAN_TAFSIR_LOCALES);

/** Shared active-source fields returned by every signed Quran read. */
export const quranSourceFields = {
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  snapshotId: v.union(v.string(), v.null()),
  sourceRevision: v.union(v.string(), v.null()),
};
