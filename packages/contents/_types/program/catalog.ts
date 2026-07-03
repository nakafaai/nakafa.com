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
  cambridgeInternational: LearningProgramKeySchema.make(
    "cambridge-international"
  ),
  merdeka: LearningProgramKeySchema.make("merdeka"),
  singaporeMoe: LearningProgramKeySchema.make("singapore-moe"),
  snbt2026: LearningProgramKeySchema.make("snbt-2026"),
  tka2026: LearningProgramKeySchema.make("tka-2026"),
  unitedStates: LearningProgramKeySchema.make("united-states"),
} as const;

const learningProgramCatalogInput = [
  {
    defaultCoverageStatus: "partial",
    displayOrder: 10,
    iconKey: "school",
    key: LEARNING_PROGRAM_KEYS.merdeka,
    kind: "school-curriculum",
    navigation: {
      levels: ["stage", "class", "subject", "topic"],
      model: "curriculum-tree",
    },
    provider: { homeCountry: "ID", kind: "official", name: "Kemendikdasmen" },
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
        publicSlug: "merdeka",
        title: "Kurikulum Merdeka",
      },
      id: {
        publicSlug: "merdeka",
        title: "Kurikulum Merdeka",
      },
    },
    version: { label: "Indonesia" },
  },
  {
    defaultCoverageStatus: "planned",
    displayOrder: 20,
    iconKey: "global-education",
    key: LEARNING_PROGRAM_KEYS.cambridgeInternational,
    kind: "school-curriculum",
    navigation: {
      levels: ["stage", "course", "unit", "lesson"],
      model: "curriculum-tree",
    },
    provider: {
      homeCountry: "GB",
      kind: "official",
      name: "Cambridge International Education",
    },
    sources: [
      {
        label: "Cambridge Pathway programmes",
        retrievedAt: SOURCE_RETRIEVED_AT_2026_06_16,
        reviewAfter: PROGRAM_2027_END,
        type: "official-portal",
        url: "https://www.cambridgeinternational.org/programmes-and-qualifications/",
      },
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
      {
        label: "Cambridge IGCSE Biology 0610 syllabus 2026-2028",
        retrievedAt: SOURCE_RETRIEVED_AT_2026_06_16,
        reviewAfter: PROGRAM_2028_REVIEW,
        type: "official-blueprint",
        url: "https://www.cambridgeinternational.org/Images/697203-2026-2028-syllabus.pdf",
      },
      {
        label: "Cambridge IGCSE Chemistry 0620 syllabus 2026-2028",
        retrievedAt: SOURCE_RETRIEVED_AT_2026_06_16,
        reviewAfter: PROGRAM_2028_REVIEW,
        type: "official-blueprint",
        url: "https://www.cambridgeinternational.org/Images/697205-2026-2028-syllabus.pdf",
      },
      {
        label: "Cambridge IGCSE Physics 0625 syllabus 2026-2028",
        retrievedAt: SOURCE_RETRIEVED_AT_2026_06_16,
        reviewAfter: PROGRAM_2028_REVIEW,
        type: "official-blueprint",
        url: "https://www.cambridgeinternational.org/Images/697209-2026-2028-syllabus.pdf",
      },
    ],
    translations: {
      en: {
        publicSlug: "cambridge-international",
        title: "Cambridge International",
      },
      id: {
        publicSlug: "cambridge-international",
        title: "Cambridge International",
      },
    },
    version: {
      label: "Cambridge Pathway",
      startsAt: PROGRAM_2025_START,
      endsAt: PROGRAM_2027_END,
    },
  },
  {
    defaultCoverageStatus: "planned",
    displayOrder: 30,
    iconKey: "state",
    key: LEARNING_PROGRAM_KEYS.singaporeMoe,
    kind: "school-curriculum",
    navigation: {
      levels: ["stage", "course", "unit", "lesson"],
      model: "curriculum-tree",
    },
    provider: {
      homeCountry: "SG",
      kind: "official",
      name: "Ministry of Education Singapore",
    },
    recommendedCountry: "SG",
    sources: [
      {
        label: "Singapore Primary School Education",
        retrievedAt: SOURCE_RETRIEVED_AT_2026_06_16,
        reviewAfter: PROGRAM_2028_REVIEW,
        type: "official-portal",
        url: "https://www.moe.gov.sg/primary",
      },
      {
        label: "Singapore Secondary School Education",
        retrievedAt: SOURCE_RETRIEVED_AT_2026_06_16,
        reviewAfter: PROGRAM_2028_REVIEW,
        type: "official-portal",
        url: "https://www.moe.gov.sg/secondary",
      },
      {
        label: "Singapore G2/G3 Mathematics syllabuses",
        retrievedAt: SOURCE_RETRIEVED_AT_2026_06_16,
        reviewAfter: PROGRAM_2028_REVIEW,
        type: "official-blueprint",
        url: "https://www.moe.gov.sg/api/media/d415c25d-cf29-4b05-83da-9713f38edd14/2020-G2-and-G3-Mathematics-Syllabuses.pdf",
      },
      {
        label: "Singapore G2/G3 Additional Mathematics syllabuses",
        retrievedAt: SOURCE_RETRIEVED_AT_2026_06_16,
        reviewAfter: PROGRAM_2028_REVIEW,
        type: "official-blueprint",
        url: "https://www.moe.gov.sg/api/media/2155cce5-f6b4-4532-897c-c5a8fa1852c6/2020-G2-and-G3-Additional-Mathematics-Syllabuses.pdf",
      },
      {
        label: "Singapore G2/G3 Lower Secondary Science syllabus",
        retrievedAt: SOURCE_RETRIEVED_AT_2026_06_16,
        reviewAfter: PROGRAM_2028_REVIEW,
        type: "official-blueprint",
        url: "https://www.moe.gov.sg/api/media/b6d63789-2ad0-4630-b847-42fd380ec404/G2-3-Lower-Secondary-Science-Teaching-and-Learning-Syllabus.pdf",
      },
      {
        label: "Singapore Pre-university Education",
        retrievedAt: SOURCE_RETRIEVED_AT_2026_06_16,
        reviewAfter: PROGRAM_2028_REVIEW,
        type: "official-portal",
        url: "https://www.moe.gov.sg/post-secondary/a-level-curriculum-and-subject-syllabuses",
      },
    ],
    translations: {
      en: {
        publicSlug: "singapore-moe",
        title: "Singapore MOE",
      },
      id: {
        publicSlug: "singapore-moe",
        title: "Singapore MOE",
      },
    },
    version: { label: "Singapore MOE" },
  },
  {
    defaultCoverageStatus: "planned",
    displayOrder: 40,
    iconKey: "standards",
    key: LEARNING_PROGRAM_KEYS.unitedStates,
    kind: "school-curriculum",
    navigation: {
      levels: ["stage", "course", "unit", "lesson"],
      model: "curriculum-tree",
    },
    provider: {
      homeCountry: "US",
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
        publicSlug: "united-states",
        title: "United States Standards-Aligned Pathway",
      },
      id: {
        publicSlug: "amerika-serikat",
        title: "United States Standards-Aligned Pathway",
      },
    },
    version: { label: "K-12 standards-aligned pathway" },
  },
  {
    defaultCoverageStatus: "planned",
    displayOrder: 50,
    iconKey: "assessment",
    key: LEARNING_PROGRAM_KEYS.tka2026,
    kind: "assessment",
    navigation: {
      levels: ["section", "domain", "practice-set"],
      model: "exam-domain-practice-set",
    },
    provider: { homeCountry: "ID", kind: "official", name: "Kemendikdasmen" },
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
        publicSlug: "tka",
        title: "TKA 2026",
      },
      id: {
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
    displayOrder: 60,
    iconKey: "certificate",
    key: LEARNING_PROGRAM_KEYS.snbt2026,
    kind: "admission-exam",
    navigation: {
      levels: ["section", "domain", "practice-set"],
      model: "exam-domain-practice-set",
    },
    provider: { homeCountry: "ID", kind: "official", name: "SNPMB" },
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
        publicSlug: "snbt",
        title: "SNBT 2026",
      },
      id: {
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
