import { describe, expect, it } from "@effect/vitest";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { convexModules } from "@repo/backend/confect/test.setup";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { testProofRenderer } from "@repo/backend/test/content/proof";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { makeProgramRuntimeSource } from "@repo/backend/test/program/runtime";
import {
  itWithRuntimeRelease,
  TEST_RUNTIME_RELEASE,
} from "@repo/backend/test/runtime/values";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

const readActive = api.contentRelease.runtime.active.read;

describe("contentRelease/runtime/active", () => {
  itWithRuntimeRelease(
    "distinguishes an empty publication from one complete active identity",
    async (runtime) => {
      const empty = convexTest(schema, convexModules);
      await expect(empty.query(readActive, {})).resolves.toBeNull();

      const active = convexTest(schema, convexModules);
      await active.mutation((ctx) => insertRuntimeRelease(ctx));
      await expect(active.query(readActive, {})).resolves.toEqual({
        manifestHash: runtime.manifestHash,
        releaseId: TEST_RUNTIME_RELEASE.releaseId,
        sequence: TEST_RUNTIME_RELEASE.sequence,
        snapshots: { assessment: null, program: null, quran: null },
      });
    }
  );

  it.effect(
    "names the snapshot that each structured family resolves to under the release",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeProgramRuntimeSource();
        const context = yield* createTestPublication(fixture.source);

        expect(
          yield* context.query(contentRelease.runtime.active.read, {})
        ).toMatchObject({
          snapshots: {
            assessment: null,
            program: fixture.data.snapshotId,
            quran: null,
          },
        });
      })
  );

  it("fails visibly when active state or release identity is partial", async () => {
    const partial = convexTest(schema, convexModules);
    await partial.mutation((ctx) =>
      ctx.db.insert("contentState", {
        activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
        articleSlot: "blue",
        key: "primary",
        materialSlot: "blue",
        nextSequence: 4,
        searchSlot: "blue",
        updatedAt: 1,
      })
    );
    await expect(partial.query(readActive, {})).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const mismatch = convexTest(schema, convexModules);
    await mismatch.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected an active release.");
      }
      await ctx.db.patch("contentReleases", release._id, { sequence: 2 });
    });
    await expect(mismatch.query(readActive, {})).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const rendererMismatch = convexTest(schema, convexModules);
    await rendererMismatch.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected an active release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        rendererJson: Schema.encodeSync(
          Schema.fromJsonString(RendererManifestEnvelopeSchema)
        )(testProofRenderer("blockquote")),
      });
    });
    await expect(rendererMismatch.query(readActive, {})).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
