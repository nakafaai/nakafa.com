import path from "node:path";
import type { internal } from "@repo/backend/convex/_generated/api";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

type TopicArgs = FunctionArgs<
  typeof internal.contentSync.mutations.curriculum.bulkSyncCurriculumTopics
>;
type SectionArgs = FunctionArgs<
  typeof internal.contentSync.mutations.curriculum.bulkSyncCurriculumLessons
>;
interface MaterialTopicFixture {
  description?: string;
  domain: TopicArgs["topics"][number]["material"];
  key: string;
  locale: TopicArgs["topics"][number]["locale"];
  order: number;
  sections: Array<{ order: number; section: string; slug: string }>;
  slug: string;
  title: string;
  topic: string;
}

/** Resolves one content fixture path from the backend package cwd. */
function getContentFile(...segments: string[]) {
  return path.resolve(process.cwd(), "../contents", ...segments);
}

/** Loads the curriculum sync module with mocked Convex IO. */
async function loadSubjects({
  materialTopics = [
    {
      domain: "mathematics",
      key: "lesson.mathematics.exponential-logarithm",
      locale: "id",
      order: 0,
      sections: [
        {
          order: 0,
          section: "basic-concept",
          slug: "material/lesson/mathematics/exponential-logarithm/basic-concept",
        },
      ],
      slug: "material/lesson/mathematics/exponential-logarithm",
      title: "Eksponen dan Logaritma",
      topic: "exponential-logarithm",
    },
    {
      domain: "mathematics",
      key: "lesson.mathematics.sequence-series",
      locale: "id",
      order: 1,
      sections: [],
      slug: "material/lesson/mathematics/sequence-series",
      title: "Barisan dan Deret",
      topic: "sequence-series",
    },
    {
      domain: "mathematics",
      key: "lesson.mathematics.vector-operations",
      locale: "id",
      order: 2,
      sections: [],
      slug: "material/lesson/mathematics/vector-operations",
      title: "Vektor dan Operasinya",
      topic: "vector-operations",
    },
  ],
  sectionFiles,
}: {
  materialTopics?: MaterialTopicFixture[];
  sectionFiles: string[];
}) {
  const sectionCalls: SectionArgs[] = [];
  const topicCalls: TopicArgs[] = [];

  vi.doMock("@repo/backend/scripts/sync-content/convex/client", () => ({
    /** Records curriculum sync mutation payloads without calling Convex. */
    callConvexMutation: (
      _config: ConvexConfig,
      _functionRef: unknown,
      args: SectionArgs | TopicArgs
    ) => {
      if ("topics" in args) {
        topicCalls.push(args);
        return Effect.succeed({
          created: args.topics.length,
          unchanged: 0,
          updated: 0,
        });
      }

      sectionCalls.push(args);
      return Effect.succeed({
        authorLinksCreated: 0,
        created: args.sections.length,
        skipped: 0,
        unchanged: 0,
        updated: 0,
      });
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/runtime/files", () => ({
    /** Returns MDX fixture files for the requested subject glob. */
    globFiles: () => Effect.succeed(sectionFiles),
  }));
  vi.doMock("@repo/contents/_types/curriculum/projection", async () => {
    const actual = await vi.importActual<
      typeof import("@repo/contents/_types/curriculum/projection")
    >("@repo/contents/_types/curriculum/projection");
    const curriculumNodes = [
      {
        curriculumKey: "merdeka",
        key: "class-10",
        level: "class",
        materialKeys: [],
        order: 1,
        translations: {
          en: { routeSlug: "class-10", title: "Class 10" },
          id: { routeSlug: "kelas-10", title: "Kelas 10" },
        },
      },
      {
        curriculumKey: "merdeka",
        key: "class-10-mathematics",
        level: "subject",
        materialKeys: [],
        order: 1,
        parentKey: "class-10",
        translations: {
          en: { routeSlug: "mathematics", title: "Mathematics" },
          id: { routeSlug: "matematika", title: "Matematika" },
        },
      },
      ...materialTopics.map((topic) => ({
        curriculumKey: "merdeka",
        key: `class-10-mathematics-${topic.topic}`,
        level: "topic",
        materialKeys: [topic.key],
        order: topic.order,
        parentKey: "class-10-mathematics",
        translations: {
          en: { routeSlug: topic.topic, title: topic.title },
          id: { routeSlug: topic.topic, title: topic.title },
        },
      })),
    ];

    return {
      ...actual,
      /** Returns typed curriculum placements for curriculum sync. */
      listCurriculumNodes: () => curriculumNodes,
      projectCurriculumNodes: () => Effect.succeed(curriculumNodes),
    };
  });
  vi.doMock("@repo/contents/_types/material/registry", () => ({
    /** Returns typed Material sources for curriculum placement lookup. */
    listLessonMaterialSources: () =>
      materialTopics.map((topic) => ({
        assetRoot: topic.slug,
        domain: topic.domain,
        key: topic.key,
        kind: "lesson",
        sections: [],
        slug: topic.topic,
        translations: {
          en: { title: topic.title },
          id: { title: topic.title },
        },
      })),
    /** Returns typed Material topic fixtures for curriculum sync. */
    listLessonRows: () => materialTopics,
  }));

  const subjects = await import(
    "@repo/backend/scripts/sync-content/content/curriculum"
  );

  return { sectionCalls, subjects, topicCalls };
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("sync-content subjects", () => {
  it("syncs curriculum topic order from typed Material data", async () => {
    const { subjects, topicCalls } = await loadSubjects({
      sectionFiles: [
        getContentFile(
          "material",
          "lesson",
          "mathematics",
          "exponential-logarithm",
          "basic-concept",
          "id.mdx"
        ),
      ],
    });

    await Effect.runPromise(
      subjects.syncCurriculumTopics(config, { locale: "id", quiet: true })
    );

    const topics = topicCalls.flatMap((call) => call.topics);
    expect(topics.map((topic) => topic.title).slice(0, 3)).toEqual([
      "Eksponen dan Logaritma",
      "Barisan dan Deret",
      "Vektor dan Operasinya",
    ]);
    expect(topics.map((topic) => topic.order).slice(0, 3)).toEqual([0, 1, 2]);
    expect(topics.map((topic) => topic.sectionCount).slice(0, 3)).toEqual([
      1, 0, 0,
    ]);
  });

  it("ignores neutral lesson files when no curriculum maps them", async () => {
    const { subjects, topicCalls } = await loadSubjects({
      materialTopics: [],
      sectionFiles: [
        getContentFile(
          "material",
          "lesson",
          "mathematics",
          "exponential-logarithm",
          "basic-concept",
          "id.mdx"
        ),
      ],
    });

    await Effect.runPromise(
      subjects.syncCurriculumTopics(config, { locale: "id", quiet: true })
    );

    expect(topicCalls).toEqual([]);
  });

  it("syncs curriculum lesson order from typed Material data", async () => {
    const { sectionCalls, subjects } = await loadSubjects({
      sectionFiles: [
        getContentFile(
          "material",
          "lesson",
          "mathematics",
          "exponential-logarithm",
          "basic-concept",
          "id.mdx"
        ),
      ],
    });

    await Effect.runPromise(
      subjects.syncCurriculumLessons(config, { locale: "id", quiet: true })
    );

    expect(sectionCalls.flatMap((call) => call.sections)).toEqual([
      expect.objectContaining({
        order: 0,
        slug: "material/lesson/mathematics/exponential-logarithm/basic-concept",
        topicSlug: "material/lesson/mathematics/exponential-logarithm",
      }),
    ]);
  });

  it("skips neutral lesson files when no curriculum maps them", async () => {
    const { sectionCalls, subjects } = await loadSubjects({
      materialTopics: [],
      sectionFiles: [
        getContentFile(
          "material",
          "lesson",
          "mathematics",
          "exponential-logarithm",
          "basic-concept",
          "id.mdx"
        ),
      ],
    });

    await Effect.runPromise(
      subjects.syncCurriculumLessons(config, { locale: "id", quiet: true })
    );

    expect(sectionCalls).toEqual([]);
  });

  it("fails before publishing sections when a mapped curriculum topic is missing section order", async () => {
    const { sectionCalls, subjects } = await loadSubjects({
      materialTopics: [
        {
          domain: "mathematics",
          key: "lesson.mathematics.exponential-logarithm",
          locale: "id",
          order: 0,
          sections: [],
          slug: "material/lesson/mathematics/exponential-logarithm",
          title: "Eksponen dan Logaritma",
          topic: "exponential-logarithm",
        },
      ],
      sectionFiles: [
        getContentFile(
          "material",
          "lesson",
          "mathematics",
          "exponential-logarithm",
          "basic-concept",
          "id.mdx"
        ),
      ],
    });

    await expect(
      Effect.runPromise(
        subjects.syncCurriculumLessons(config, { locale: "id", quiet: true })
      )
    ).rejects.toThrow("Missing curriculum lesson order");
    expect(sectionCalls).toEqual([]);
  });
});
