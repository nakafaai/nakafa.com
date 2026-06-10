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
  materialFiles,
  sectionFiles,
}: {
  materialFiles: string[];
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
    /** Returns material or MDX files based on the requested subject glob. */
    globFiles: (pattern: string) =>
      Effect.succeed(pattern.includes("_data") ? materialFiles : sectionFiles),
  }));

  const subjects = await import("@repo/backend/scripts/sync-content/subjects");

  return { sectionCalls, subjects, topicCalls };
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("sync-content subjects", () => {
  it("syncs subject topic order from authored material data", async () => {
    const { subjects, topicCalls } = await loadSubjects({
      materialFiles: [
        getContentFile(
          "subject",
          "high-school",
          "10",
          "mathematics",
          "_data",
          "id-material.ts"
        ),
      ],
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

  it("fails before publishing topics when an authored subject section is missing material order", async () => {
    const { subjects, topicCalls } = await loadSubjects({
      materialFiles: [],
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
    ).rejects.toThrow("Missing subject material order");
    expect(topicCalls).toEqual([]);
  });

  it("syncs subject section order from authored material data", async () => {
    const { sectionCalls, subjects } = await loadSubjects({
      materialFiles: [
        getContentFile(
          "subject",
          "high-school",
          "10",
          "mathematics",
          "_data",
          "id-material.ts"
        ),
      ],
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
      materialFiles: [],
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
    ).rejects.toThrow("Missing subject material order");
    expect(sectionCalls).toEqual([]);
  });
});
