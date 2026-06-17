import {
  type LearningProgram,
  LearningProgramKeySchema,
  LearningProgramSchema,
  ProgramDateOnlySchema,
} from "@repo/contents/_types/program/schema";
import { Schema } from "effect";

const SOURCE_RETRIEVED_AT = ProgramDateOnlySchema.make("2026-06-14");
const SOURCE_RETRIEVED_AT_2026_06_16 = ProgramDateOnlySchema.make("2026-06-16");
const PROGRAM_2025_START = ProgramDateOnlySchema.make("2025-01-01");
const PROGRAM_2026_START = ProgramDateOnlySchema.make("2026-01-01");
const PROGRAM_2026_END = ProgramDateOnlySchema.make("2026-12-31");
const PROGRAM_2027_REVIEW = ProgramDateOnlySchema.make("2027-01-01");
const PROGRAM_2027_END = ProgramDateOnlySchema.make("2027-12-31");
const PROGRAM_2028_REVIEW = ProgramDateOnlySchema.make("2028-01-01");

/** Canonical program keys owned by the source-controlled program registry. */
export const LEARNING_PROGRAM_KEYS = {
  cambridgeIgcse: LearningProgramKeySchema.make("cambridge-igcse"),
  indonesiaMerdekaCurriculum: LearningProgramKeySchema.make(
    "id-kurikulum-merdeka"
  ),
  snbt2026: LearningProgramKeySchema.make("snbt-2026"),
  tka2026: LearningProgramKeySchema.make("tka-2026"),
  usCommonCoreNgss: LearningProgramKeySchema.make("us-common-core-ngss"),
} as const;

const learningProgramCatalogInput = [
  {
    defaultCoverageStatus: "partial",
    displayOrder: 10,
    key: LEARNING_PROGRAM_KEYS.indonesiaMerdekaCurriculum,
    kind: "school-curriculum",
    navigation: {
      levels: ["class", "subject", "topic"],
      model: "class-curriculum-topic",
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
        publicSlug: "merdeka",
        title: "Kurikulum Merdeka",
      },
      id: {
        description: "Ikuti materi sekolah Indonesia sesuai kelas.",
        publicSlug: "merdeka",
        title: "Kurikulum Merdeka",
      },
    },
    version: { label: "Indonesia" },
  },
  {
    defaultCoverageStatus: "planned",
    displayOrder: 20,
    key: LEARNING_PROGRAM_KEYS.cambridgeIgcse,
    kind: "school-curriculum",
    navigation: {
      levels: ["course", "unit", "lesson"],
      model: "course-unit-lesson",
    },
    provider: {
      country: "GB",
      kind: "official",
      name: "Cambridge International Education",
    },
    sources: [
      {
        label: "Cambridge IGCSE Mathematics 0580",
        retrievedAt: SOURCE_RETRIEVED_AT_2026_06_16,
        reviewAfter: PROGRAM_2027_END,
        type: "official-portal",
        url: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-0580/",
      },
      {
        label: "Cambridge IGCSE Mathematics 0580 syllabus 2025-2027",
        retrievedAt: SOURCE_RETRIEVED_AT_2026_06_16,
        reviewAfter: PROGRAM_2027_END,
        type: "official-blueprint",
        url: "https://www.cambridgeinternational.org/Images/662466-2025-2027-syllabus.pdf",
      },
    ],
    translations: {
      en: {
        description:
          "Build number, algebra, geometry, and data skills for Cambridge IGCSE.",
        publicSlug: "cambridge-igcse",
        title: "Cambridge IGCSE",
      },
      id: {
        description:
          "Bangun kemampuan bilangan, aljabar, geometri, dan data untuk Cambridge IGCSE.",
        publicSlug: "cambridge-igcse",
        title: "Cambridge IGCSE",
      },
    },
    version: {
      label: "2025-2027",
      startsAt: PROGRAM_2025_START,
      endsAt: PROGRAM_2027_END,
    },
  },
  {
    defaultCoverageStatus: "planned",
    displayOrder: 30,
    key: LEARNING_PROGRAM_KEYS.usCommonCoreNgss,
    kind: "school-curriculum",
    navigation: {
      levels: ["course", "unit", "lesson"],
      model: "course-unit-lesson",
    },
    provider: {
      country: "US",
      kind: "official",
      name: "CCSSO / NGSS Lead States",
    },
    sources: [
      {
        label: "Common Core State Standards for Mathematics",
        retrievedAt: SOURCE_RETRIEVED_AT_2026_06_16,
        reviewAfter: PROGRAM_2028_REVIEW,
        type: "official-blueprint",
        url: "https://learning.ccsso.org/wp-content/uploads/2022/11/ADA-Compliant-Math-Standards.pdf",
      },
      {
        label: "Next Generation Science Standards",
        retrievedAt: SOURCE_RETRIEVED_AT_2026_06_16,
        reviewAfter: PROGRAM_2028_REVIEW,
        type: "official-portal",
        url: "https://www.nextgenscience.org/",
      },
    ],
    translations: {
      en: {
        description:
          "Follow high school math and science standards by course and unit.",
        publicSlug: "us-common-core-ngss",
        title: "Common Core Math + NGSS",
      },
      id: {
        description:
          "Ikuti standar matematika dan sains SMA sesuai kursus dan unit.",
        publicSlug: "us-common-core-ngss",
        title: "Common Core Math + NGSS",
      },
    },
    version: { label: "High school standards" },
  },
  {
    defaultCoverageStatus: "planned",
    displayOrder: 40,
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
        publicSlug: "tka",
        title: "TKA 2026",
      },
      id: {
        description: "Siapkan diri untuk Tes Kemampuan Akademik.",
        publicSlug: "tka",
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
    displayOrder: 50,
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
        publicSlug: "snbt",
        title: "SNBT 2026",
      },
      id: {
        description: "Siapkan UTBK-SNBT untuk seleksi masuk kampus.",
        publicSlug: "snbt",
        title: "SNBT 2026",
      },
    },
    version: {
      label: "2026",
      startsAt: PROGRAM_2026_START,
      endsAt: PROGRAM_2026_END,
    },
  },
];

/**
 * Source-controlled program registry for canonical curriculum/product identity.
 *
 * Registry rows describe top-level programs only: stable key, kind, provider,
 * official sources, version window, default availability, localized display
 * copy, and the program's navigation structure. They must not enumerate
 * subjects, topics, routes, or content rows; coverage sync derives that read
 * model from curriculum material mappings and bounded assessment rules.
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

/** Finds one catalog program by its stable program key. */
export function findLearningProgramByKey(
  key: string,
  programs: readonly LearningProgram[] = LEARNING_PROGRAM_CATALOG
) {
  return programs.find((program) => program.key === key) ?? null;
}
