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
  MaterialLessonProjectionSchema,
  MaterialProjectionV2Schema,
  MaterialSectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { Effect } from "effect";

/** Creates the exact graph identity derived from one material source key. */
export function testMaterialGraph(
  topic: string,
  section: string,
  locale: ContentLocale = "en"
) {
  return Effect.runSync(
    makeLearningGraphIdentity({
      concept: ["material", "lesson", "test", topic],
      learningObject: ["material-section", "test", topic, section],
      lens: ["material", "lesson", "test"],
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
  return JSON.stringify({
    contentKey: options?.contentKey ?? `test:head-${index}`,
    graph: testMaterialGraph(topic, topic, locale),
    kind: "subject-lesson",
    locale,
    materialKey: `lesson.test.${topic}`,
    metadata: {
      authors: [{ name: "Nakafa" }],
      date: "2026-07-22",
      title: options?.title ?? `Technical Head ${index}`,
    },
    order: index + 1,
    parentPath: "test",
    publicPath: options?.publicPath ?? `test/head-${index}`,
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
export const FUNCTION_MATERIAL_V2 = MaterialProjectionV2Schema.make({
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
});
export const FUNCTION_MATERIAL_V2_JSON =
  canonicalizeMaterialProjection(FUNCTION_MATERIAL_V2);

/** Creates one exact technical material projection for read-model tests. */
export function makeMaterialProjection(
  locale: ContentLocale,
  order: number,
  materialIndex = 0
) {
  const section = `section-${order}`;
  const topic = materialIndex === 0 ? "topic" : `topic-${materialIndex}`;
  const contentKey = ContentKeySchema.make(
    `material/lesson/test/${topic}/${section}`
  );
  const namespace = locale === "en" ? "subjects" : "materi";
  const topicSlug = locale === "en" ? `technical-${topic}` : `teknis-${topic}`;
  return MaterialLessonProjectionSchema.make({
    contentKey,
    graph: testMaterialGraph(topic, section, locale),
    kind: "subject-lesson",
    locale,
    materialKey: MaterialKeySchema.make(`lesson.test.${topic}`),
    metadata: {
      authors: [{ name: "Nakafa" }],
      date: "2026-07-24",
      title: `${locale.toUpperCase()} Section ${order}`,
    },
    order,
    parentPath: PublicPathSchema.make(`${namespace}/test/${topicSlug}`),
    publicPath: PublicPathSchema.make(
      `${namespace}/test/${topicSlug}/${section}`
    ),
    sectionKey: MaterialSectionSchema.make(section),
    sitemap: true,
    topicTitle:
      materialIndex === 0
        ? `${locale.toUpperCase()} Technical Topic`
        : `${locale.toUpperCase()} Technical Topic ${materialIndex}`,
  });
}
