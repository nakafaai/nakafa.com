import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import { ContentProjectionSchema } from "@nakafa/aksara-contracts/projection/spec";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { SEARCH_DOCUMENT_LIMIT } from "@repo/backend/confect/contentRelease/document";
import {
  deleteSearchEntry,
  writeSearchEntry,
} from "@repo/backend/confect/contentRelease/search/write";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { testProjectionJson } from "@repo/backend/test/content/material";
import {
  TEST_PAGE_KEY,
  TEST_PAGE_PROJECTION,
  TEST_PAGE_SOURCE,
} from "@repo/backend/test/content/page";
import { TEST_DIGEST } from "@repo/backend/test/content/release";
import type { WithoutSystemFields } from "convex/server";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

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
    artifactLocale: "en",
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
        publicPath: "subjects/test/search",
        title: "Search title",
      })
    )
  );
}

/** Creates one valid non-routed question projection for exclusion coverage. */
function questionProjection() {
  const setKey = "question-bank/tryout/indonesia/snbt/general/set-1";
  const questionKey = `${setKey}/question-1`;
  return Schema.decodeSync(ContentProjectionSchema)({
    bodyKind: "question",
    contentKey: `${questionKey}/question`,
    kind: "question-body",
    artifactLocale: "en",
    metadata: {
      authors: [
        {
          name: "Nakafa",
        },
      ],
      datePublished: "2026-07-24",
      title: "Technical question",
    },
    peerContentKey: `${questionKey}/answer`,
    questionKey,
    questionNumber: 1,
    response: {
      kind: "single-choice",
      options: [
        {
          isCorrect: true,
          label: "Correct",
          optionKey: "option-1",
          order: 1,
        },
        {
          isCorrect: false,
          label: "Incorrect",
          optionKey: "option-2",
          order: 2,
        },
      ],
    },
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
  return writeSearchEntry("blue", head, projection, plainText).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(confectSchema, ctx))
  );
}
describe("contentRelease/search/write", () => {
  it("stores deterministic public text and replaces one active identity", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => Effect.runPromise(write(ctx, testHead())));
    await t.mutation((ctx) => Effect.runPromise(write(ctx, testHead())));
    await t.mutation((ctx) =>
      Effect.runPromise(
        write(
          ctx,
          {
            ...testHead(),
            sequence: 2,
          },
          materialProjection(),
          "Next"
        )
      )
    );
    const rows = await t.run((ctx) => ctx.db.query("contentIndex").take(2));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      contentKey: "test:search",
      publicPath: "subjects/test/search",
      sequence: 2,
      text: expect.stringContaining("Next"),
    });
  });
  it("rejects non-public and non-search projections at the writer boundary", async () => {
    const t = convexTest(schema, convexModules);
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          write(
            ctx,
            testHead({
              delivery: "authenticated",
            })
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
    const question = questionProjection();
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          write(
            ctx,
            {
              ...testHead({
                contentKey: question.contentKey,
              }),
              family: "question",
            },
            question
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          write(
            ctx,
            {
              ...testHead({
                contentKey: TEST_PAGE_KEY,
              }),
              family: "page",
              rendererDomain: "site",
              sourcePath: TEST_PAGE_SOURCE,
            },
            TEST_PAGE_PROJECTION
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
    await expect(
      t.run((ctx) => ctx.db.query("contentIndex").take(1))
    ).resolves.toEqual([]);
  });
  it("rejects invalid heads and oversized active entries", async () => {
    const invalid = convexTest(schema, convexModules);
    await expect(
      invalid.mutation((ctx) =>
        Effect.runPromise(
          write(
            ctx,
            testHead({
              operation: "delete",
            })
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
    await expect(
      invalid.mutation((ctx) =>
        Effect.runPromise(
          write(
            ctx,
            testHead({
              projectionHash: "",
            })
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
    await expect(
      invalid.mutation((ctx) =>
        Effect.runPromise(
          write(ctx, {
            ...testHead(),
            family: "article",
          })
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
      message: "Search entry test:search/en changed family.",
    });
    const oversized = convexTest(schema, convexModules);
    await expect(
      oversized.mutation((ctx) =>
        Effect.runPromise(
          write(
            ctx,
            testHead(),
            materialProjection(),
            "x".repeat(SEARCH_DOCUMENT_LIMIT)
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_SIZE",
    });
  });
  it("deletes one active search entry and tolerates its absence", async () => {
    const t = convexTest(schema, convexModules);
    const head = testHead();
    await t.mutation((ctx) => Effect.runPromise(write(ctx, head)));
    await t.mutation(async (ctx) => {
      await Effect.runPromise(
        deleteSearchEntry("blue", head.contentKey, head.artifactLocale).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
      await Effect.runPromise(
        deleteSearchEntry("blue", head.contentKey, head.artifactLocale).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
    });
    await expect(
      t.run((ctx) => ctx.db.query("contentIndex").take(1))
    ).resolves.toEqual([]);
  });
});
