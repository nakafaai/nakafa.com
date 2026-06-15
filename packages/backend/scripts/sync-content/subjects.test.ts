import path from "node:path";
import type { internal } from "@repo/backend/convex/_generated/api";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/types";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

type TopicArgs = FunctionArgs<
  typeof internal.contentSync.mutations.subjects.bulkSyncSubjectTopics
>;
type SectionArgs = FunctionArgs<
  typeof internal.contentSync.mutations.subjects.bulkSyncSubjectSections
>;

/** Resolves one content fixture path from the backend package cwd. */
function getContentFile(...segments: string[]) {
  return path.resolve(process.cwd(), "../contents", ...segments);
}

/** Loads the subject sync module with mocked Convex IO. */
async function loadSubjects({
  planTopics = [
    {
      category: "high-school",
      grade: "10",
      locale: "id",
      material: "mathematics",
      order: 0,
      sections: [
        {
          order: 0,
          section: "basic-concept",
          slug: "subject/high-school/10/mathematics/exponential-logarithm/basic-concept",
        },
      ],
      slug: "subject/high-school/10/mathematics/exponential-logarithm",
      title: "Eksponen dan Logaritma",
      topic: "exponential-logarithm",
    },
    {
      category: "high-school",
      grade: "10",
      locale: "id",
      material: "mathematics",
      order: 1,
      sections: [],
      slug: "subject/high-school/10/mathematics/sequence-series",
      title: "Barisan dan Deret",
      topic: "sequence-series",
    },
    {
      category: "high-school",
      grade: "10",
      locale: "id",
      material: "mathematics",
      order: 2,
      sections: [],
      slug: "subject/high-school/10/mathematics/vector-operations",
      title: "Vektor dan Operasinya",
      topic: "vector-operations",
    },
  ],
  sectionFiles,
}: {
  planTopics?: ReturnType<
    typeof import("@repo/contents/_types/plan/registry").listSubjectTopics
  >;
  sectionFiles: string[];
}) {
  const sectionCalls: SectionArgs[] = [];
  const topicCalls: TopicArgs[] = [];

  vi.doMock("@repo/backend/scripts/sync-content/convex", () => ({
    /** Records subject sync mutation payloads without calling Convex. */
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
  vi.doMock("@repo/backend/scripts/sync-content/runtime", () => ({
    /** Returns MDX fixture files for the requested subject glob. */
    globFiles: () => Effect.succeed(sectionFiles),
  }));
  vi.doMock("@repo/contents/_types/plan/registry", () => ({
    /** Returns typed Plan topic fixtures for subject sync. */
    listSubjectTopics: () => planTopics,
  }));

  const subjects = await import("@repo/backend/scripts/sync-content/subjects");

  return { sectionCalls, subjects, topicCalls };
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("sync-content subjects", () => {
  it("syncs subject topic order from typed Plan data", async () => {
    const { subjects, topicCalls } = await loadSubjects({
      sectionFiles: [
        getContentFile(
          "subject",
          "high-school",
          "10",
          "mathematics",
          "exponential-logarithm",
          "basic-concept",
          "id.mdx"
        ),
      ],
    });

    await Effect.runPromise(
      subjects.syncSubjectTopics(config, { locale: "id", quiet: true })
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

  it("fails before publishing topics when an authored subject section is missing plan order", async () => {
    const { subjects, topicCalls } = await loadSubjects({
      planTopics: [],
      sectionFiles: [
        getContentFile(
          "subject",
          "high-school",
          "10",
          "mathematics",
          "exponential-logarithm",
          "basic-concept",
          "id.mdx"
        ),
      ],
    });

    await expect(
      Effect.runPromise(
        subjects.syncSubjectTopics(config, { locale: "id", quiet: true })
      )
    ).rejects.toThrow("Missing subject plan order");
    expect(topicCalls).toEqual([]);
  });

  it("syncs subject section order from typed Plan data", async () => {
    const { sectionCalls, subjects } = await loadSubjects({
      sectionFiles: [
        getContentFile(
          "subject",
          "high-school",
          "10",
          "mathematics",
          "exponential-logarithm",
          "basic-concept",
          "id.mdx"
        ),
      ],
    });

    await Effect.runPromise(
      subjects.syncSubjectSections(config, { locale: "id", quiet: true })
    );

    expect(sectionCalls.flatMap((call) => call.sections)).toEqual([
      expect.objectContaining({
        order: 0,
        slug: "subject/high-school/10/mathematics/exponential-logarithm/basic-concept",
        topicSlug: "subject/high-school/10/mathematics/exponential-logarithm",
      }),
    ]);
  });

  it("fails before publishing sections when authored section order is missing", async () => {
    const { sectionCalls, subjects } = await loadSubjects({
      planTopics: [],
      sectionFiles: [
        getContentFile(
          "subject",
          "high-school",
          "10",
          "mathematics",
          "exponential-logarithm",
          "basic-concept",
          "id.mdx"
        ),
      ],
    });

    await expect(
      Effect.runPromise(
        subjects.syncSubjectSections(config, { locale: "id", quiet: true })
      )
    ).rejects.toThrow("Missing subject plan order");
    expect(sectionCalls).toEqual([]);
  });
});
