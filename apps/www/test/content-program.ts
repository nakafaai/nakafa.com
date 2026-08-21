import {
  CorpusSourcePathSchema,
  PublicPathSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  type ActiveAppLocaleCode,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { MaterialDomainSchema } from "@nakafa/aksara-contracts/material/domain";
import {
  CurriculumNodeKeySchema,
  type CurriculumRoute,
  CurriculumRouteSchema,
} from "@nakafa/aksara-contracts/program/curriculum";
import {
  type LearningProgram,
  LearningProgramKeySchema,
  LearningProgramSchema,
} from "@nakafa/aksara-contracts/program/spec";
import { MaterialKeySchema } from "@nakafa/aksara-contracts/projection/material";
import {
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";

const rowHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const sourcePath = CorpusSourcePathSchema.make(
  "packages/corpus/curriculum/merdeka"
);
const programKey = LearningProgramKeySchema.make("merdeka");
const materialDomain = MaterialDomainSchema.make("mathematics");
const materialKey = MaterialKeySchema.make(
  "lesson.mathematics.function-composition-inverse-function"
);
const materialContextNodeKey = CurriculumNodeKeySchema.make(
  "class-11-mathematics-function-composition-inverse-function"
);

/** Exact reviewed Merdeka program represented by the signed current contract. */
export const testPublishedProgram = LearningProgramSchema.make({
  defaultCoverageStatus: "partial",
  displayOrder: 10,
  iconKey: "school",
  key: programKey,
  kind: "school-curriculum",
  navigation: {
    levels: ["stage", "class", "subject", "topic"],
    model: "curriculum-tree",
  },
  provider: {
    homeCountry: "ID",
    kind: "official",
    name: "Kemendikdasmen",
  },
  recommendedCountry: "ID",
  sources: [
    {
      label: "Capaian Pembelajaran dan ATP",
      retrievedAt: "2026-06-14",
      reviewAfter: "2027-01-01",
      type: "official-policy",
      url: "https://guru.kemendikdasmen.go.id/kurikulum/referensi-penerapan/capaian-pembelajaran/",
    },
  ],
  translations: [
    {
      appLocale: AppLocaleSchema.make("en"),
      publicSlug: "merdeka",
      title: "Kurikulum Merdeka",
    },
    {
      appLocale: AppLocaleSchema.make("id"),
      publicSlug: "merdeka",
      title: "Kurikulum Merdeka",
    },
    {
      appLocale: AppLocaleSchema.make("de"),
      publicSlug: "merdeka",
      title: "Kurikulum Merdeka",
    },
  ],
  version: { label: "Indonesia" },
});

const englishRoot = CurriculumRouteSchema.make({
  iconKey: "school",
  kind: "curriculum-context",
  level: "track",
  appLocale: AppLocaleSchema.make("en"),
  nodeKey: "merdeka:root",
  order: 10,
  programKey: testPublishedProgram.key,
  publicPath: PublicPathSchema.make("curriculum/merdeka"),
  sitemap: true,
  sourcePath,
  title: "Kurikulum Merdeka",
});

const englishClass = CurriculumRouteSchema.make({
  displayGroupIconKey: "high-school",
  displayGroupTitle: "Upper Secondary",
  iconKey: "grade-11",
  kind: "curriculum-context",
  level: "class",
  appLocale: AppLocaleSchema.make("en"),
  nodeKey: "class-11",
  order: 110,
  parentPath: englishRoot.publicPath,
  programKey: testPublishedProgram.key,
  publicPath: PublicPathSchema.make("curriculum/merdeka/class-11"),
  sitemap: true,
  sourcePath,
  title: "Class 11",
});

const englishSubject = CurriculumRouteSchema.make({
  iconKey: "mathematics",
  kind: "curriculum-context",
  level: "subject",
  appLocale: AppLocaleSchema.make("en"),
  materialDomain,
  nodeKey: "class-11-mathematics",
  order: 30,
  parentPath: englishClass.publicPath,
  programKey: testPublishedProgram.key,
  publicPath: PublicPathSchema.make("curriculum/merdeka/class-11/mathematics"),
  sitemap: true,
  sourcePath,
  title: "Mathematics",
});

const englishGroup = CurriculumRouteSchema.make({
  iconKey: "mathematics",
  kind: "curriculum-context",
  level: "unit",
  appLocale: AppLocaleSchema.make("en"),
  materialCardDescription: "Operate on functions and domains.",
  materialCardTitle: "Function Composition and Inverses",
  materialDomain,
  nodeKey: "class-11-mathematics-function-composition-inverse-function",
  order: 30,
  parentPath: englishSubject.publicPath,
  programKey: testPublishedProgram.key,
  publicPath: PublicPathSchema.make(
    "curriculum/merdeka/class-11/mathematics/function-composition-inverse-function"
  ),
  sitemap: false,
  sourcePath,
  title: "Function Composition and Inverses",
});

const englishPlacement = CurriculumRouteSchema.make({
  canonicalPath: PublicPathSchema.make(
    "subjects/mathematics/function-composition-inverse-function"
  ),
  iconKey: "mathematics",
  kind: "curriculum-context",
  level: "lesson",
  appLocale: AppLocaleSchema.make("en"),
  materialContextNodeKey,
  materialContextParentPath: englishSubject.publicPath,
  materialContextPublicPath: englishGroup.publicPath,
  materialDomain,
  materialKey,
  nodeKey:
    "class-11-mathematics-function-composition-inverse-function-material",
  order: 10,
  parentPath: englishGroup.publicPath,
  programKey: testPublishedProgram.key,
  publicPath: PublicPathSchema.make(
    "curriculum/merdeka/class-11/mathematics/function-composition-inverse-function/function-composition-inverse-function"
  ),
  sitemap: false,
  sourcePath,
  title: "Function Composition and Inverse Function",
});

const indonesianRoot = CurriculumRouteSchema.make({
  ...englishRoot,
  appLocale: AppLocaleSchema.make("id"),
  publicPath: PublicPathSchema.make("kurikulum/merdeka"),
});

const indonesianClass = CurriculumRouteSchema.make({
  ...englishClass,
  displayGroupTitle: "SMA",
  appLocale: AppLocaleSchema.make("id"),
  parentPath: indonesianRoot.publicPath,
  publicPath: PublicPathSchema.make("kurikulum/merdeka/kelas-11"),
  title: "Kelas 11",
});

const indonesianSubject = CurriculumRouteSchema.make({
  ...englishSubject,
  appLocale: AppLocaleSchema.make("id"),
  parentPath: indonesianClass.publicPath,
  publicPath: PublicPathSchema.make("kurikulum/merdeka/kelas-11/matematika"),
  title: "Matematika",
});

const germanRoot = CurriculumRouteSchema.make({
  ...englishRoot,
  appLocale: AppLocaleSchema.make("de"),
  publicPath: PublicPathSchema.make("lehrplaene/merdeka"),
});

const germanClass = CurriculumRouteSchema.make({
  ...englishClass,
  displayGroupTitle: "Sekundarstufe II (SMA)",
  appLocale: AppLocaleSchema.make("de"),
  parentPath: germanRoot.publicPath,
  publicPath: PublicPathSchema.make("lehrplaene/merdeka/klasse-11"),
  title: "Klasse 11",
});

const germanSubject = CurriculumRouteSchema.make({
  ...englishSubject,
  appLocale: AppLocaleSchema.make("de"),
  parentPath: germanClass.publicPath,
  publicPath: PublicPathSchema.make("lehrplaene/merdeka/klasse-11/mathematik"),
  title: "Mathematik",
});

const publishedRoutes = [
  englishRoot,
  englishClass,
  englishSubject,
  englishGroup,
  englishPlacement,
  indonesianRoot,
  indonesianClass,
  indonesianSubject,
  germanRoot,
  germanClass,
  germanSubject,
];

/** Reads one explicit signed-contract route fixture by localized public path. */
export function readTestPublishedRoute(
  publicPath: string,
  locale: ActiveAppLocaleCode = "en"
) {
  const route = publishedRoutes.find(
    (candidate) =>
      candidate.appLocale === locale && candidate.publicPath === publicPath
  );

  if (!route) {
    throw new Error(`Missing published route fixture: ${locale}/${publicPath}`);
  }

  return route;
}

/** Serializes one program as a verified snapshot row fixture. */
export function testProgramRowJson(
  program: LearningProgram = testPublishedProgram
) {
  return canonicalizeContentSnapshotRow({
    family: "program",
    record: { kind: "program", row: program, rowHash },
  } satisfies ContentSnapshotRow);
}

/** Serializes one curriculum route as a verified snapshot row fixture. */
export function testCurriculumRowJson(route: CurriculumRoute) {
  return canonicalizeContentSnapshotRow({
    family: "program",
    record: { kind: "curriculum", row: route, rowHash },
  } satisfies ContentSnapshotRow);
}

/** Exact English Merdeka root used by program runtime tests. */
export const testProgramRoot = englishRoot;

/** Exact English Merdeka class route used by program runtime tests. */
export const testProgramClass = englishClass;

/** Exact English mathematics route owning the Function Concept material. */
export const testProgramSubject = englishSubject;

/** Exact context row that attaches Function Concept to Merdeka mathematics. */
export const testProgramContexts = [englishPlacement];

/** Exact card-group row referenced by the Function Concept context. */
export const testProgramGroups = [englishGroup];
