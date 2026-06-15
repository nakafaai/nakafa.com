import {
  type LearningProgram,
  LearningProgramKeySchema,
  LearningProgramSchema,
  ProgramDateOnlySchema,
} from "@repo/contents/_types/program/schema";
import { Schema } from "effect";

const SOURCE_RETRIEVED_AT = ProgramDateOnlySchema.make("2026-06-14");
const PROGRAM_2026_START = ProgramDateOnlySchema.make("2026-01-01");
const PROGRAM_2026_END = ProgramDateOnlySchema.make("2026-12-31");
const PROGRAM_2027_REVIEW = ProgramDateOnlySchema.make("2027-01-01");

/** Canonical program keys owned by the source-controlled program registry. */
export const LEARNING_PROGRAM_KEYS = {
  idKurikulumMerdeka: LearningProgramKeySchema.make("id-kurikulum-merdeka"),
  nakafaStemPath: LearningProgramKeySchema.make("nakafa-stem-path"),
  snbt2026: LearningProgramKeySchema.make("snbt-2026"),
  tka2026: LearningProgramKeySchema.make("tka-2026"),
} as const;

const learningProgramCatalogInput = [
  {
    defaultCoverageStatus: "available",
    displayOrder: 10,
    key: LEARNING_PROGRAM_KEYS.nakafaStemPath,
    kind: "nakafa-path",
    navigation: {
      levels: ["track", "topic"],
      model: "track-topic",
    },
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
    translations: {
      en: {
        description: "Start with core math and science foundations.",
        title: "Learn from basics",
      },
      id: {
        description: "Mulai dari matematika dan sains dasar.",
        title: "Belajar dari dasar",
      },
    },
    version: { label: "2026", startsAt: PROGRAM_2026_START },
  },
  {
    defaultCoverageStatus: "partial",
    displayOrder: 20,
    key: LEARNING_PROGRAM_KEYS.idKurikulumMerdeka,
    kind: "school-curriculum",
    navigation: {
      levels: ["class", "subject", "topic"],
      model: "class-subject-topic",
    },
    provider: { country: "ID", kind: "official", name: "Kemendikdasmen" },
    recommendedCountry: "ID",
    sources: [
      {
        label: "Capaian Pembelajaran dan ATP",
        retrievedAt: SOURCE_RETRIEVED_AT,
        reviewAfter: PROGRAM_2027_REVIEW,
        type: "official-policy",
        url: "https://guru.kemendikdasmen.go.id/kurikulum/referensi-penerapan/capaian-pembelajaran/",
      },
    ],
    translations: {
      en: {
        description: "Follow Indonesia's school curriculum by class topic.",
        title: "Kurikulum Merdeka",
      },
      id: {
        description: "Ikuti materi sekolah Indonesia sesuai kelas.",
        title: "Kurikulum Merdeka",
      },
    },
    version: { label: "Indonesia" },
  },
  {
    defaultCoverageStatus: "planned",
    displayOrder: 30,
    key: LEARNING_PROGRAM_KEYS.tka2026,
    kind: "assessment",
    navigation: {
      levels: ["section", "domain", "practice-set"],
      model: "exam-domain-practice-set",
    },
    provider: { country: "ID", kind: "official", name: "Kemendikdasmen" },
    recommendedCountry: "ID",
    sources: [
      {
        label: "Portal TKA",
        retrievedAt: SOURCE_RETRIEVED_AT,
        reviewAfter: PROGRAM_2026_END,
        type: "official-portal",
        url: "https://tka.kemendikdasmen.go.id/",
      },
      {
        label: "Penjelasan TKA Rumah Pendidikan",
        retrievedAt: SOURCE_RETRIEVED_AT,
        reviewAfter: PROGRAM_2026_END,
        type: "official-policy",
        url: "https://pusatinformasi.rumahpendidikan.kemendikdasmen.go.id/hc/id/articles/52474902769689-Kenali-Tes-Kemampuan-Akademik-TKA",
      },
    ],
    translations: {
      en: {
        description: "Prepare for Indonesia's academic readiness test.",
        title: "TKA 2026",
      },
      id: {
        description: "Siapkan diri untuk Tes Kemampuan Akademik.",
        title: "TKA 2026",
      },
    },
    version: {
      label: "2026",
      startsAt: PROGRAM_2026_START,
      endsAt: PROGRAM_2026_END,
    },
  },
  {
    defaultCoverageStatus: "partial",
    displayOrder: 40,
    key: LEARNING_PROGRAM_KEYS.snbt2026,
    kind: "admission-exam",
    navigation: {
      levels: ["section", "domain", "practice-set"],
      model: "exam-domain-practice-set",
    },
    provider: { country: "ID", kind: "official", name: "SNPMB" },
    recommendedCountry: "ID",
    sources: [
      {
        label: "Informasi Umum UTBK-SNBT 2026",
        retrievedAt: SOURCE_RETRIEVED_AT,
        reviewAfter: PROGRAM_2026_END,
        type: "official-blueprint",
        url: "https://snpmb.id/utbk-snbt/informasi-umum",
      },
    ],
    translations: {
      en: {
        description: "Prepare for Indonesia's university entrance selection.",
        title: "SNBT 2026",
      },
      id: {
        description: "Siapkan UTBK-SNBT untuk seleksi masuk kampus.",
        title: "SNBT 2026",
      },
    },
    version: {
      label: "2026",
      startsAt: PROGRAM_2026_START,
      endsAt: PROGRAM_2026_END,
    },
  },
] satisfies readonly LearningProgram[];

/**
 * Source-controlled program registry for canonical curriculum/product identity.
 *
 * Registry rows describe top-level programs only: stable key, kind, provider,
 * official sources, version window, default availability, localized display
 * copy, and the program's navigation structure. They must not enumerate
 * subjects, topics, routes, or content rows; coverage sync derives that read
 * model from graph routes and alignment rules.
 */
export const LEARNING_PROGRAM_CATALOG = Schema.decodeUnknownSync(
  Schema.Array(LearningProgramSchema)
)(learningProgramCatalogInput);

/** Returns source-registry programs that may be presented in discovery surfaces. */
export function listDiscoverableLearningPrograms(
  programs: readonly LearningProgram[] = LEARNING_PROGRAM_CATALOG
) {
  return programs.filter(
    (program) => program.defaultCoverageStatus !== "hidden"
  );
}

/** Returns the selectable fallback program key for learners without a profile. */
export function getDefaultLearningProgramKey() {
  return LEARNING_PROGRAM_KEYS.nakafaStemPath;
}

/** Finds one catalog program by its stable program key. */
export function findLearningProgramByKey(
  key: string,
  programs: readonly LearningProgram[] = LEARNING_PROGRAM_CATALOG
) {
  return programs.find((program) => program.key === key) ?? null;
}
