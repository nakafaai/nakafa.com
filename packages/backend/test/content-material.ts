import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import { makeLearningGraphIdentity } from "@nakafa/aksara-contracts/graph/identity";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  canonicalizeMaterialProjection,
  MaterialKeySchema,
  type MaterialLessonProjection,
  MaterialLessonProjectionSchema,
  MaterialSectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { createNakafaContentRefFromGraphProjection } from "@repo/contents/_lib/agent/refs";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import {
  readDomainSlug,
  readNamespaceSegment,
} from "@repo/contents/_types/route/path";
import { Effect, Option } from "effect";

const TEST_MATERIAL_DOMAIN = "mathematics";

/** Resolves the registered localized route prefix for material test rows. */
function readTestMaterialPrefix(locale: ContentLocale) {
  const namespace = readNamespaceSegment("subject", locale);
  const domain = readDomainSlug(
    MATERIAL_ROUTE_DOMAINS,
    "lesson",
    TEST_MATERIAL_DOMAIN,
    locale
  );
  if (!(namespace && domain)) {
    throw new Error(`Missing ${locale} material test route prefix.`);
  }
  return `${namespace}/${domain}`;
}

/** Creates one localized registered material route for release tests. */
export function testMaterialPublicPath(
  index: number,
  locale: ContentLocale = "en"
) {
  return `${readTestMaterialPrefix(locale)}/technical-heads/head-${index}`;
}

/** Creates one complete agent reference from a material projection fixture. */
export function makeMaterialContentRef(projection: MaterialLessonProjection) {
  const ref = createNakafaContentRefFromGraphProjection({
    ...projection.graph,
    content_id: projection.graph.assetId,
    locale: projection.locale,
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
  locale: ContentLocale = "en",
  domain = "test"
) {
  return Effect.runSync(
    makeLearningGraphIdentity({
      concept: ["material", "lesson", domain, topic],
      learningObject: ["material-section", domain, topic, section],
      lens: ["material", "lesson", domain],
      locale,
    })
  );
}

/** Creates one canonical technical material projection. */
export function testProjectionJson(options?: {
  readonly contentKey?: string;
  readonly index?: number;
  readonly locale?: ContentLocale;
  readonly publicPath?: string;
  readonly title?: string;
}) {
  const index = options?.index ?? 0;
  const locale = options?.locale ?? "en";
  const topic = `head-${index}`;
  const publicPath =
    options?.publicPath ?? testMaterialPublicPath(index, locale);
  const parentPath = publicPath.slice(0, publicPath.lastIndexOf("/"));
  return JSON.stringify({
    contentKey: options?.contentKey ?? `test:head-${index}`,
    graph: testMaterialGraph(
      "technical-heads",
      topic,
      locale,
      TEST_MATERIAL_DOMAIN
    ),
    kind: "subject-lesson",
    locale,
    materialKey: `lesson.${TEST_MATERIAL_DOMAIN}.technical-heads`,
    metadata: {
      authors: [{ name: "Nakafa" }],
      date: "2026-07-22",
      title: options?.title ?? `Technical Head ${index}`,
    },
    order: index + 1,
    parentPath,
    publicPath,
    sectionKey: topic,
    sitemap: true,
    topicTitle: `Technical Topic ${index}`,
  });
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
      locale: "en",
    })
  ),
  kind: "subject-lesson",
  locale: "en",
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
  locale: ContentLocale,
  order: number,
  materialIndex = 0
) {
  const section = `section-${order}`;
  const topic = materialIndex === 0 ? "topic" : `topic-${materialIndex}`;
  const contentKey = ContentKeySchema.make(
    `material/lesson/${TEST_MATERIAL_DOMAIN}/technical-${topic}/${section}`
  );
  const routePrefix = readTestMaterialPrefix(locale);
  const topicSlug = locale === "en" ? `technical-${topic}` : `teknis-${topic}`;
  return MaterialLessonProjectionSchema.make({
    contentKey,
    graph: testMaterialGraph(
      `technical-${topic}`,
      section,
      locale,
      TEST_MATERIAL_DOMAIN
    ),
    kind: "subject-lesson",
    locale,
    materialKey: MaterialKeySchema.make(
      `lesson.${TEST_MATERIAL_DOMAIN}.technical-${topic}`
    ),
    metadata: {
      authors: [{ name: "Nakafa" }],
      date: "2026-07-24",
      title: `${locale.toUpperCase()} Section ${order}`,
    },
    order,
    parentPath: PublicPathSchema.make(`${routePrefix}/${topicSlug}`),
    publicPath: PublicPathSchema.make(`${routePrefix}/${topicSlug}/${section}`),
    sectionKey: MaterialSectionSchema.make(section),
    sitemap: true,
    topicTitle:
      materialIndex === 0
        ? `${locale.toUpperCase()} Technical Topic`
        : `${locale.toUpperCase()} Technical Topic ${materialIndex}`,
  });
}
