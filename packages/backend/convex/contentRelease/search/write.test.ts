import { ContentProjectionSchema } from "@nakafa/aksara-contracts/projection/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { SEARCH_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import {
  deleteSearchEntry,
  writeSearchEntry,
} from "@repo/backend/convex/contentRelease/search/write";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_DIGEST,
  testProjectionJson,
} from "@repo/backend/test/content-release";
import type { WithoutSystemFields } from "convex/server";
import { convexTest } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

type ContentHead = WithoutSystemFields<Doc<"contentHeads">>;

/** Builds one complete technical head for the search writer boundary. */
function testHead(options?: {
  readonly contentKey?: string;
  readonly delivery?: ContentHead["delivery"];
  readonly operation?: ContentHead["operation"];
  readonly projectionHash?: string;
}): ContentHead {
  return {
    artifactHash: `sha256:${"2".repeat(64)}`,
    compilerConfigHash: TEST_DIGEST,
    contentKey: options?.contentKey ?? "test:search",
    delivery: options?.delivery ?? "public",
    family: "material",
    index: 0,
    locale: "en",
    operation: options?.operation ?? "upsert",
    projectionHash: options?.projectionHash ?? TEST_DIGEST,
    projectionJson: testProjectionJson(),
    releaseId: "release-search-write",
    rendererDomain: "mathematics",
    sequence: 1,
    sourceHash: TEST_DIGEST,
    sourcePath: "packages/corpus/test/search/en.mdx",
  };
}

/** Decodes one complete material projection through the production contract. */
function materialProjection() {
  return Schema.decodeUnknownSync(ContentProjectionSchema)(
    JSON.parse(
      testProjectionJson({
        contentKey: "test:search",
        publicPath: "test/search",
        title: "Search title",
      })
    )
  );
}

/** Creates one valid non-routed question projection for exclusion coverage. */
function questionProjection() {
  const setKey = "question-bank/tryout/indonesia/snbt/general/set-1";
  const questionKey = `${setKey}/question-1`;
  return Schema.decodeUnknownSync(ContentProjectionSchema)({
    bodyKind: "question",
    choices: [
      { label: "Correct", value: true },
      { label: "Incorrect", value: false },
    ],
    contentKey: `${questionKey}/question`,
    kind: "question-body",
    locale: "en",
    metadata: {
      authors: [{ name: "Nakafa" }],
      date: "2026-07-24",
      title: "Technical question",
    },
    peerContentKey: `${questionKey}/answer`,
    questionKey,
    questionNumber: 1,
    setKey,
  });
}

/** Runs the write program at the native Convex mutation boundary. */
function write(
  ctx: MutationCtx,
  head: ContentHead,
  projection = materialProjection(),
  plainText = "Search body"
) {
  return runConvexProgram(writeSearchEntry(ctx, head, projection, plainText));
}

describe("contentRelease/search/write", () => {
  it("stores deterministic public text and replaces one active identity", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => write(ctx, testHead()));
    await t.mutation((ctx) => write(ctx, testHead()));
    await t.mutation((ctx) =>
      write(ctx, { ...testHead(), sequence: 2 }, materialProjection(), "Next")
    );

    const rows = await t.run((ctx) => ctx.db.query("contentIndex").take(2));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      contentKey: "test:search",
      publicPath: "test/search",
      sequence: 2,
      text: expect.stringContaining("Next"),
    });
  });

  it("rejects non-public and question bodies at the writer boundary", async () => {
    const t = convexTest(schema, convexModules);
    await expect(
      t.mutation((ctx) => write(ctx, testHead({ delivery: "authenticated" })))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    const question = questionProjection();
    await expect(
      t.mutation((ctx) =>
        write(
          ctx,
          {
            ...testHead({ contentKey: question.contentKey }),
            family: "question",
          },
          question
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    await expect(
      t.run((ctx) => ctx.db.query("contentIndex").take(1))
    ).resolves.toEqual([]);
  });

  it("rejects invalid heads and oversized active entries", async () => {
    const invalid = convexTest(schema, convexModules);
    await expect(
      invalid.mutation((ctx) => write(ctx, testHead({ operation: "delete" })))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(
      invalid.mutation((ctx) => write(ctx, testHead({ projectionHash: "" })))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const oversized = convexTest(schema, convexModules);
    await expect(
      oversized.mutation((ctx) =>
        write(
          ctx,
          testHead(),
          materialProjection(),
          "x".repeat(SEARCH_DOCUMENT_LIMIT)
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_SIZE" },
    });
  });

  it("deletes one active search entry and tolerates its absence", async () => {
    const t = convexTest(schema, convexModules);
    const head = testHead();
    await t.mutation((ctx) => write(ctx, head));
    await t.mutation(async (ctx) => {
      await runConvexProgram(
        deleteSearchEntry(ctx, head.contentKey, head.locale)
      );
      await runConvexProgram(
        deleteSearchEntry(ctx, head.contentKey, head.locale)
      );
    });

    await expect(
      t.run((ctx) => ctx.db.query("contentIndex").take(1))
    ).resolves.toEqual([]);
  });
});
