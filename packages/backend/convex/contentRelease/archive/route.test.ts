// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
  CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
} from "@repo/backend/content/endpoint";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  claim,
  claimId,
  clearEnvironment,
  finalize,
  hash,
  identity,
  insert,
  post,
  setEnvironment,
  sourceHash,
  storeArchiveFixture as store,
  write,
} from "@repo/backend/test/archive";

beforeEach(setEnvironment);
afterEach(clearEnvironment);

describe("content runtime archive routes", () => {
  it("binds one archive and returns metadata with one download capability", async () => {
    const target = createConvexTestWithBetterAuth();
    const index = 3;
    const value = "encrypted-runtime-archive";
    const storageId = await store(target, value);
    await claim(target, index);

    const stored = await finalize(target, index, storageId, value);
    const repeated = await finalize(target, index, storageId, value);
    const download = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
      JSON.stringify(identity(index)),
      "read"
    );
    const existingClaim = await write(
      target,
      CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
      { ...identity(index), claimId: claimId(4) }
    );

    expect(stored.status).toBe(200);
    await expect(stored.json()).resolves.toMatchObject({ kind: "stored" });
    await expect(repeated.json()).resolves.toMatchObject({ kind: "unchanged" });
    await expect(download.json()).resolves.toMatchObject({
      ...identity(index),
      archiveSha256: hash(value),
      byteLength: Buffer.byteLength(value),
      downloadUrl: expect.stringContaining("/api/storage/"),
      sourceStateHash: sourceHash(index),
    });
    await expect(existingClaim.json()).resolves.toMatchObject({
      kind: "existing",
    });
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", storageId))
    ).resolves.not.toBeNull();
  });

  it("turns every stale canonical storage invariant into a new export claim", async () => {
    const target = createConvexTestWithBetterAuth();
    const absent = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
      JSON.stringify(identity(9)),
      "read"
    );
    expect(absent.status).toBe(404);

    const cases = [
      { deleted: true },
      { contentType: "application/octet-stream" },
      { archiveSha256: "a".repeat(64) },
      { byteLength: 1 },
    ];

    for (const [offset, testCase] of cases.entries()) {
      const index = offset + 10;
      const value = `stale-runtime-archive-${index}`;
      const storageId = await store(target, value, testCase.contentType);
      await insert(target, index, storageId, value, testCase);
      if (testCase.deleted) {
        await target.run((ctx) => ctx.storage.delete(storageId));
      }

      const missing = await post(
        target,
        CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
        JSON.stringify(identity(index)),
        "read"
      );
      const reclaimed = await claim(target, index);

      expect(missing.status).toBe(404);
      await expect(missing.json()).resolves.toEqual({
        code: "CONTENT_RUNTIME_ARCHIVE_NOT_FOUND",
      });
      await expect(reclaimed.json()).resolves.toMatchObject({
        kind: "claimed",
      });
    }
    await expect(
      target.run((ctx) => ctx.db.query("contentRuntimeArchives").collect())
    ).resolves.toHaveLength(0);
  });
});
