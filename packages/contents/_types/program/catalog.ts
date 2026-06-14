import {
  type LearningProgram,
  LearningProgramSchema,
} from "@repo/contents/_types/program/schema";
import { Schema } from "effect";

const SOURCE_RETRIEVED_AT = "2026-06-14";

const learningProgramCatalogInput = [
  {
    defaultCoverageStatus: "available",
    description:
      "Graph-native STEM path for learners without one official curriculum.",
    displayOrder: 10,
    key: "nakafa-stem-path",
    kind: "nakafa-path",
    locale: "id",
    provider: {
      kind: "nakafa",
      name: "Nakafa",
    },
    sources: [
      {
        label: "Nakafa Learning Graph",
        retrievedAt: SOURCE_RETRIEVED_AT,
        type: "nakafa-editorial",
        url: "https://nakafa.com",
      },
    ],
    title: "Nakafa STEM Path",
    version: { label: "2026", startsAt: "2026-01-01" },
  },
  {
    defaultCoverageStatus: "partial",
    description:
      "Indonesia school curriculum alignment backed by graph coverage.",
    displayOrder: 20,
    key: "id-kurikulum-merdeka",
    kind: "school-curriculum",
    locale: "id",
    provider: { country: "ID", kind: "official", name: "Kemendikdasmen" },
    recommendedCountry: "ID",
    sources: [
      {
        label: "Capaian Pembelajaran dan ATP",
        retrievedAt: SOURCE_RETRIEVED_AT,
        reviewAfter: "2027-01-01",
        type: "official-policy",
        url: "https://guru.kemendikdasmen.go.id/kurikulum/referensi-penerapan/capaian-pembelajaran/",
      },
    ],
    title: "Kurikulum Merdeka",
    version: { label: "Indonesia" },
  },
  {
    defaultCoverageStatus: "planned",
    description: "Tes Kemampuan Akademik preparation as an assessment program.",
    displayOrder: 30,
    key: "tka-2026",
    kind: "assessment",
    locale: "id",
    provider: { country: "ID", kind: "official", name: "Kemendikdasmen" },
    recommendedCountry: "ID",
    sources: [
      {
        label: "Portal TKA",
        retrievedAt: SOURCE_RETRIEVED_AT,
        reviewAfter: "2026-12-31",
        type: "official-portal",
        url: "https://tka.kemendikdasmen.go.id/",
      },
      {
        label: "Penjelasan TKA Rumah Pendidikan",
        retrievedAt: SOURCE_RETRIEVED_AT,
        reviewAfter: "2026-12-31",
        type: "official-policy",
        url: "https://pusatinformasi.rumahpendidikan.kemendikdasmen.go.id/hc/id/articles/52474902769689-Kenali-Tes-Kemampuan-Akademik-TKA",
      },
    ],
    title: "TKA 2026",
    version: {
      label: "2026",
      startsAt: "2026-01-01",
      endsAt: "2026-12-31",
    },
  },
  {
    defaultCoverageStatus: "partial",
    description: "UTBK-SNBT preparation for the 2026 admission cycle.",
    displayOrder: 40,
    key: "snbt-2026",
    kind: "admission-exam",
    locale: "id",
    provider: { country: "ID", kind: "official", name: "SNPMB" },
    recommendedCountry: "ID",
    sources: [
      {
        label: "Informasi Umum UTBK-SNBT 2026",
        retrievedAt: SOURCE_RETRIEVED_AT,
        reviewAfter: "2026-12-31",
        type: "official-blueprint",
        url: "https://snpmb.id/utbk-snbt/informasi-umum",
      },
    ],
    title: "SNBT 2026",
    version: {
      label: "2026",
      startsAt: "2026-01-01",
      endsAt: "2026-12-31",
    },
  },
] satisfies readonly LearningProgram[];

/** Initial public and planned programs used to seed the Convex catalog. */
export const LEARNING_PROGRAM_CATALOG = Schema.decodeUnknownSync(
  Schema.Array(LearningProgramSchema)
)(learningProgramCatalogInput);

/** Returns catalog programs that may be presented in discovery surfaces. */
export function listDiscoverableLearningPrograms(
  programs: readonly LearningProgram[] = LEARNING_PROGRAM_CATALOG
) {
  return programs.filter(
    (program) => program.defaultCoverageStatus !== "hidden"
  );
}

/** Returns the selectable fallback program key for learners without a profile. */
export function getDefaultLearningProgramKey() {
  return "nakafa-stem-path";
}

/** Finds one catalog program by its stable program key. */
export function findLearningProgramByKey(
  key: string,
  programs: readonly LearningProgram[] = LEARNING_PROGRAM_CATALOG
) {
  return programs.find((program) => program.key === key) ?? null;
}
