// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
  CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH,
} from "@repo/backend/content/endpoint";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { MAX_CONTENT_RUNTIME_ARCHIVES } from "@repo/backend/convex/contentRelease/archive/spec";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  type ArchiveTest,
  claimId,
  clearEnvironment,
  hash,
  identity,
  setEnvironment,
  sourceHash,
  storeArchiveFixture as store,
  write,
} from "@repo/backend/test/archive";

async function insertArchive(
  target: ArchiveTest,
  index: number,
  createdAt: number
) {
  const value = `retained-runtime-archive-${index}`;
  const archiveSha256 = hash(value);
  const storageId = await store(target, value);
  await target.run((ctx) =>
    ctx.db.insert("contentRuntimeArchives", {
      ...identity(index),
      archiveSha256,
      byteLength: Buffer.byteLength(value),
      createdAt,
      sourceStateHash: sourceHash(index),
      storageId,
    })
  );
  return storageId;
}

async function storeNewArchive(target: ArchiveTest, index: number) {
  const value = `new-runtime-archive-${index}`;
  const input = { ...identity(index), claimId: claimId(index) };
  await write(target, CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH, input);
  const storageId = await store(target, value);
  const response = await write(target, CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH, {
    ...input,
    archiveSha256: hash(value),
    byteLength: Buffer.byteLength(value),
    sourceStateHash: sourceHash(index),
    storageId,
  });
  expect(response.status).toBe(200);
}

beforeEach(setEnvironment);
afterEach(clearEnvironment);

describe("content runtime archive retention", () => {
  it("preserves the current archive when its identity remains unchanged", async () => {
    const target = createConvexTestWithBetterAuth();
    const storageId = await insertArchive(
      target,
      0,
      Date.now() - ROLLBACK_RETENTION_MS - 60_000
    );

    const result = await target.mutation(
      internal.contentRelease.archive.cleanup.sweep,
      {}
    );

    expect(result.archivesDeleted).toBe(0);
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", storageId))
    ).resolves.not.toBeNull();
    await expect(
      target.run((ctx) => ctx.db.query("contentRuntimeArchives").collect())
    ).resolves.toHaveLength(1);
  });

  it("prunes expired storage while preserving the 30-day rollback window", async () => {
    const target = createConvexTestWithBetterAuth();
    const now = Date.now();
    const expiredId = await insertArchive(
      target,
      1,
      now - ROLLBACK_RETENTION_MS - 60_000
    );
    const retainedId = await insertArchive(
      target,
      2,
      now - ROLLBACK_RETENTION_MS + 60_000
    );

    await storeNewArchive(target, 3);

    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", expiredId))
    ).resolves.toBeNull();
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", retainedId))
    ).resolves.not.toBeNull();
    await expect(
      target.run((ctx) => ctx.db.query("contentRuntimeArchives").collect())
    ).resolves.toHaveLength(2);
  });

  it("deletes the oldest row and storage beyond the hard count ceiling", async () => {
    const target = createConvexTestWithBetterAuth();
    const now = Date.now();
    const storageIds: Id<"_storage">[] = [];
    for (let index = 0; index < MAX_CONTENT_RUNTIME_ARCHIVES; index += 1) {
      storageIds.push(
        await insertArchive(
          target,
          index + 10,
          now - (MAX_CONTENT_RUNTIME_ARCHIVES - index) * 1000
        )
      );
    }

    await storeNewArchive(target, 100);

    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", storageIds[0]))
    ).resolves.toBeNull();
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", storageIds[1]))
    ).resolves.not.toBeNull();
    await expect(
      target.run((ctx) => ctx.db.query("contentRuntimeArchives").collect())
    ).resolves.toHaveLength(MAX_CONTENT_RUNTIME_ARCHIVES);
  });
});
