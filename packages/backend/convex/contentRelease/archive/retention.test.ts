// @vitest-environment node

import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE } from "@repo/backend/content/archive";
import {
  CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
  CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH,
} from "@repo/backend/content/endpoint";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { MAX_CONTENT_RUNTIME_ARCHIVES } from "@repo/backend/convex/contentRelease/archive/spec";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { storeArchiveFixture } from "@repo/backend/test/archive";

const ARCHIVE_TOKEN = "technical-archive-token";
type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;

function identity(index: number) {
  return {
    runtimeSelectionHash: index.toString(16).padStart(64, "0"),
    runtimeSchemaFingerprint: "e".repeat(64),
  };
}

function sourceStateHash(index: number) {
  return (index + 1000).toString(16).padStart(64, "0");
}

function claimId(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function write(target: RuntimeTest, path: string, body: unknown) {
  return target.fetch(path, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-nakafa-archive-token": ARCHIVE_TOKEN,
    },
    method: "POST",
  });
}

async function insertArchive(
  target: RuntimeTest,
  index: number,
  createdAt: number
) {
  const value = `retained-runtime-archive-${index}`;
  const archiveSha256 = createHash("sha256").update(value).digest("hex");
  const storageId = await storeArchiveFixture(
    target,
    value,
    CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
  );
  await target.run((ctx) =>
    ctx.db.insert("contentRuntimeArchives", {
      ...identity(index),
      archiveSha256,
      byteLength: Buffer.byteLength(value),
      createdAt,
      sourceStateHash: sourceStateHash(index),
      storageId,
    })
  );
  return storageId;
}

async function storeNewArchive(target: RuntimeTest, index: number) {
  const value = `new-runtime-archive-${index}`;
  const input = { ...identity(index), claimId: claimId(index) };
  await write(target, CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH, input);
  const storageId = await storeArchiveFixture(
    target,
    value,
    CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
  );
  const response = await write(target, CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH, {
    ...input,
    archiveSha256: createHash("sha256").update(value).digest("hex"),
    byteLength: Buffer.byteLength(value),
    sourceStateHash: sourceStateHash(index),
    storageId,
  });
  expect(response.status).toBe(200);
}

beforeEach(() => {
  process.env.CONTENT_ARCHIVE_TOKEN = ARCHIVE_TOKEN;
  process.env.CONTENT_RUNTIME_TOKEN = "technical-runtime-token";
  process.env.POLAR_WEBHOOK_SECRET = "technical-webhook-secret";
});

afterEach(() => {
  delete process.env.CONTENT_ARCHIVE_TOKEN;
  delete process.env.CONTENT_RUNTIME_TOKEN;
  delete process.env.POLAR_WEBHOOK_SECRET;
});

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
