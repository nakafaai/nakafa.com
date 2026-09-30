import { describe, expect, it } from "@effect/vitest";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/confect/contentRelease/spec";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import {
  insertTestArtifact,
  testArtifactJson,
} from "@repo/backend/test/content/artifact";
import { testTextHash } from "@repo/backend/test/content/release";
import { convexTest, type TestConvex } from "convex-test";

const page = internal.contentRelease.artifact.backfill.page;
const run = internal.contentRelease.artifact.backfill.run;

/** Names one distinct technical artifact identity. */
function hashAt(index: number) {
  return `sha256:${index.toString(16).padStart(64, "0")}`;
}

/** Stores one body the way staging did before artifact facts. */
function insertBodyBeforeFacts(
  ctx: MutationCtx,
  index: number,
  retainUntil: number
) {
  return ctx.db.insert("contentArtifacts", {
    artifactHash: hashAt(index),
    artifactJson: testArtifactJson({ artifactHash: hashAt(index) }),
    createdAt: 1,
    retainUntil,
  });
}

/** Reads every stored body and fact after a backfill step. */
function stored(t: TestConvex<typeof schema>) {
  return t.run(async (ctx) => ({
    bodies: await ctx.db.query("contentArtifacts").collect(),
    facts: await ctx.db.query("contentArtifactFacts").collect(),
  }));
}

describe("contentRelease/artifact/backfill", () => {
  it("moves legacy retention into facts with at least one full window", async () => {
    const t = convexTest(schema, convexModules);
    const later = Date.now() + 2 * ROLLBACK_RETENTION_MS;
    const ids = await t.mutation(async (ctx) => ({
      expired: await insertBodyBeforeFacts(ctx, 1, 0),
      retained: await insertBodyBeforeFacts(ctx, 2, later),
      current: await insertTestArtifact(ctx, {
        artifactHash: hashAt(3),
        artifactJson: testArtifactJson({ artifactHash: hashAt(3) }),
        retainUntil: 5,
      }),
      unrecorded: await ctx.db.insert("contentArtifacts", {
        artifactHash: hashAt(4),
        artifactJson: testArtifactJson({ artifactHash: hashAt(4) }),
      }),
    }));
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentArtifactFacts", {
        artifactHash: hashAt(5),
        artifactId: await insertBodyBeforeFacts(ctx, 5, 7),
        artifactJsonHash: testTextHash(
          testArtifactJson({ artifactHash: hashAt(5) })
        ),
        retainUntil: 7,
      });
    });
    const startedAt = Date.now();

    const receipt = await t.mutation(page, { cursor: null });
    const after = await stored(t);

    expect(receipt).toEqual({
      created: 3,
      cursor: null,
      done: true,
      scanned: 5,
      stripped: 3,
    });
    for (const body of after.bodies) {
      expect(body).not.toHaveProperty("createdAt");
      expect(body).not.toHaveProperty("retainUntil");
    }
    const facts = new Map(after.facts.map((row) => [row.artifactHash, row]));
    expect(facts.get(hashAt(1))).toMatchObject({
      artifactId: ids.expired,
      artifactJsonHash: testTextHash(
        testArtifactJson({ artifactHash: hashAt(1) })
      ),
    });
    expect(facts.get(hashAt(1))?.retainUntil).toBeGreaterThanOrEqual(
      startedAt + ROLLBACK_RETENTION_MS
    );
    expect(facts.get(hashAt(2))).toMatchObject({
      artifactId: ids.retained,
      retainUntil: later,
    });
    expect(facts.get(hashAt(3))).toMatchObject({
      artifactId: ids.current,
      retainUntil: 5,
    });
    expect(facts.get(hashAt(4))?.retainUntil).toBeGreaterThanOrEqual(
      startedAt + ROLLBACK_RETENTION_MS
    );
    expect(facts.get(hashAt(5))?.retainUntil).toBe(7);
    await expect(t.mutation(page, { cursor: null })).resolves.toEqual({
      created: 0,
      cursor: null,
      done: true,
      scanned: 5,
      stripped: 0,
    });
    await expect(stored(t)).resolves.toEqual(after);
  });

  it("runs bounded pages until every stored body has facts", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      for (let index = 0; index < 40; index += 1) {
        await insertBodyBeforeFacts(ctx, index, 0);
      }
    });

    const first = await t.mutation(page, { cursor: null });
    const receipt = await t.action(run, { cursor: first.cursor });
    const after = await stored(t);

    expect(first).toMatchObject({ created: 32, done: false, scanned: 32 });
    expect(receipt).toEqual({
      created: 8,
      cursor: null,
      done: true,
      scanned: 8,
      stripped: 8,
    });
    expect(after.facts).toHaveLength(40);
    expect(
      after.facts.every(({ artifactHash, artifactId }) =>
        after.bodies.some(
          (body) =>
            body._id === artifactId && body.artifactHash === artifactHash
        )
      )
    ).toBe(true);
  });

  it("rejects facts that belong to another stored body", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertBodyBeforeFacts(ctx, 1, 0);
      await ctx.db.insert("contentArtifactFacts", {
        artifactHash: hashAt(1),
        artifactId: await insertBodyBeforeFacts(ctx, 2, 0),
        artifactJsonHash: testTextHash("{}"),
        retainUntil: 0,
      });
    });

    await expect(t.mutation(page, { cursor: null })).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
