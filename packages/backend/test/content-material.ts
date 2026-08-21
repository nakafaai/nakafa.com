import { makeLearningGraphIdentity } from "@nakafa/aksara-contracts/graph/identity";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  type ActiveAppLocaleCode,
  ActiveAppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  canonicalizeMaterialProjection,
  MaterialKeySchema,
  type MaterialLessonProjection,
  MaterialLessonProjectionSchema,
  MaterialSectionSchema,
  materialPublicNamespace,
} from "@nakafa/aksara-contracts/projection/material";
import { createNakafaContentRefFromGraphProjection } from "@repo/contents/_lib/agent/refs";
import { Effect, Option } from "effect";

const TEST_MATERIAL_DOMAIN = "mathematics";
const testTopicPrefixes = {
  de: "technisch",
  en: "technical",
  id: "teknis",
} as const satisfies Record<ActiveAppLocaleCode, string>;

/** Resolves the registered localized route prefix for material test rows. */
function readTestMaterialPrefix(appLocale: ActiveAppLocaleCode) {
  const namespace = materialPublicNamespace(
    ActiveAppLocaleSchema.make(appLocale)
  );
  return `${namespace}/${TEST_MATERIAL_DOMAIN}`;
}

/** Creates one localized registered material route for release tests. */
export function testMaterialPublicPath(
  index: number,
  appLocale: ActiveAppLocaleCode = "en"
) {
  return `${readTestMaterialPrefix(appLocale)}/technical-heads/head-${index}`;
}

/** Creates one complete agent reference from a material projection fixture. */
export function makeMaterialContentRef(projection: MaterialLessonProjection) {
  const ref = createNakafaContentRefFromGraphProjection({
    ...projection.graph,
    content_id: projection.graph.assetId,
    locale: projection.appLocale,
    route: projection.publicPath,
    section: "material",
    sourcePath: projection.contentKey,
  });
  if (Option.isNone(ref)) {
    throw new Error("Expected one valid material content reference.");
  }
  return ref.value;
}

/** Creates the exact graph identity derived from one material source key. */
export function testMaterialGraph(
  topic: string,
  section: string,
  appLocale: ActiveAppLocaleCode = "en",
  domain = "test"
) {
  return Effect.runSync(
    makeLearningGraphIdentity({
      concept: ["material", "lesson", domain, topic],
      learningObject: ["material-section", domain, topic, section],
      lens: ["material", "lesson", domain],
      appLocale: ActiveAppLocaleSchema.make(appLocale),
    })
  );
}

/** Creates one canonical technical material projection. */
export function testProjectionJson(options?: {
  readonly contentKey?: string;
  readonly index?: number;
  readonly appLocale?: ActiveAppLocaleCode;
  readonly publicPath?: string;
  readonly title?: string;
}) {
  const index = options?.index ?? 0;
  const appLocale = options?.appLocale ?? "en";
  const topic = `head-${index}`;
  const registeredPath = testMaterialPublicPath(index, appLocale);
  const publicPath = options?.publicPath ?? registeredPath;
  const projection = {
    contentKey: ContentKeySchema.make(
      options?.contentKey ?? `test:head-${index}`
    ),
    graph: testMaterialGraph(
      "technical-heads",
      topic,
      appLocale,
      TEST_MATERIAL_DOMAIN
    ),
    kind: "subject-lesson" as const,
    appLocale: ActiveAppLocaleSchema.make(appLocale),
    artifactLocale: ArtifactLocaleSchema.make(appLocale),
    materialKey: MaterialKeySchema.make(
      `lesson.${TEST_MATERIAL_DOMAIN}.technical-heads`
    ),
    metadata: {
      authors: [{ name: "Nakafa" }],
      date: "2026-07-22",
      title: options?.title ?? `Technical Head ${index}`,
    },
    order: index + 1,
    parentPath: PublicPathSchema.make(
      publicPath.slice(0, publicPath.lastIndexOf("/"))
    ),
    publicPath: PublicPathSchema.make(publicPath),
    sectionKey: MaterialSectionSchema.make(topic),
    sitemap: true as const,
    topicTitle: `Technical Topic ${index}`,
  };
  return canonicalizeMaterialProjection(
    MaterialLessonProjectionSchema.make(projection)
  );
}

export const FUNCTION_MATERIAL_KEY = ContentKeySchema.make(
  "material/lesson/mathematics/function-composition-inverse-function/function-concept"
);
export const FUNCTION_MATERIAL_PATH = PublicPathSchema.make(
  "subjects/mathematics/function-composition-inverse-function/function-concept"
);
export const FUNCTION_MATERIAL_SOURCE = CorpusSourcePathSchema.make(
  "packages/corpus/material/lesson/mathematics/function-composition-inverse-function/function-concept/en.mdx"
);
export const FUNCTION_MATERIAL = MaterialLessonProjectionSchema.make({
  contentKey: FUNCTION_MATERIAL_KEY,
  graph: Effect.runSync(
    makeLearningGraphIdentity({
      concept: [
        "material",
        "lesson",
        "mathematics",
        "function-composition-inverse-function",
      ],
      learningObject: [
        "material-section",
        "mathematics",
        "function-composition-inverse-function",
        "function-concept",
      ],
      lens: ["material", "lesson", "mathematics"],
      appLocale: ActiveAppLocaleSchema.make("en"),
    })
  ),
  kind: "subject-lesson",
  appLocale: ActiveAppLocaleSchema.make("en"),
  artifactLocale: ArtifactLocaleSchema.make("en"),
  materialKey: MaterialKeySchema.make(
    "lesson.mathematics.function-composition-inverse-function"
  ),
  metadata: {
    authors: [{ name: "Nabil Akbarazzima Fatih" }],
    date: "2025-04-27",
    description:
      "Understand functions as magic machines with interactive examples. Learn f(x) notation, input-output relationships, and the one-to-one rule.",
    subject: "Function Composition and Inverse Function",
    title: "Function Concept",
  },
  order: 5,
  parentPath: PublicPathSchema.make(
    "subjects/mathematics/function-composition-inverse-function"
  ),
  publicPath: FUNCTION_MATERIAL_PATH,
  sectionKey: MaterialSectionSchema.make("function-concept"),
  sitemap: true,
  topicTitle: "Function Composition and Inverse Function",
});
export const FUNCTION_MATERIAL_JSON =
  canonicalizeMaterialProjection(FUNCTION_MATERIAL);

/** Creates one exact technical material projection for read-model tests. */
export function makeMaterialProjection(
  appLocaleCode: ActiveAppLocaleCode,
  order: number,
  materialIndex = 0
) {
  const appLocale = ActiveAppLocaleSchema.make(appLocaleCode);
  const section = `section-${order}`;
  const topic = materialIndex === 0 ? "topic" : `topic-${materialIndex}`;
  const contentKey = ContentKeySchema.make(
    `material/lesson/${TEST_MATERIAL_DOMAIN}/technical-${topic}/${section}`
  );
  const routePrefix = readTestMaterialPrefix(appLocaleCode);
  const topicSlug = `${testTopicPrefixes[appLocaleCode]}-${topic}`;
  return MaterialLessonProjectionSchema.make({
    contentKey,
    graph: testMaterialGraph(
      `technical-${topic}`,
      section,
      appLocaleCode,
      TEST_MATERIAL_DOMAIN
    ),
    kind: "subject-lesson",
    appLocale,
    artifactLocale: ArtifactLocaleSchema.make(appLocaleCode),
    materialKey: MaterialKeySchema.make(
      `lesson.${TEST_MATERIAL_DOMAIN}.technical-${topic}`
    ),
    metadata: {
      authors: [{ name: "Nakafa" }],
      date: "2026-07-24",
      title: `${appLocaleCode.toUpperCase()} Section ${order}`,
    },
    order,
    parentPath: PublicPathSchema.make(`${routePrefix}/${topicSlug}`),
    publicPath: PublicPathSchema.make(`${routePrefix}/${topicSlug}/${section}`),
    sectionKey: MaterialSectionSchema.make(section),
    sitemap: true,
    topicTitle:
      materialIndex === 0
        ? `${appLocaleCode.toUpperCase()} Technical Topic`
        : `${appLocaleCode.toUpperCase()} Technical Topic ${materialIndex}`,
  });
}
