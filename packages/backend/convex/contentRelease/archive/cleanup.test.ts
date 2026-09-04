// @vitest-environment node

import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE,
  CONTENT_RUNTIME_ARCHIVE_LEASE_MS,
} from "@repo/backend/content/archive";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  CONTENT_RUNTIME_ARCHIVE_ORPHAN_GRACE_MS,
  CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE,
} from "@repo/backend/convex/contentRelease/archive/spec";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { storeArchiveFixture } from "@repo/backend/test/archive";

declare const Convex: {
  asyncSyscall: (operation: string, input: string) => Promise<string>;
};

const NOW = 1_800_000_000_000;
type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;

function store(target: RuntimeTest, value: string, contentType: string) {
  return storeArchiveFixture(target, value, contentType);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("content runtime archive orphan cleanup", () => {
  it("resumes bounded scans and removes only old unreferenced archive uploads", async () => {
    vi.useFakeTimers({ now: NOW });
    const target = createConvexTestWithBetterAuth();
    expect(CONTENT_RUNTIME_ARCHIVE_ORPHAN_GRACE_MS).toBeGreaterThan(
      CONTENT_RUNTIME_ARCHIVE_LEASE_MS
    );

    for (
      let index = 0;
      index < CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE;
      index += 1
    ) {
      await store(target, `foreign-${index}`, "application/octet-stream");
    }

    vi.setSystemTime(NOW + 1000);
    const orphanId = await store(
      target,
      "upload-response-lost",
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );
    const canonicalValue = "canonical-archive";
    const canonicalId = await store(
      target,
      canonicalValue,
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );
    await target.run((ctx) =>
      ctx.db.insert("contentRuntimeArchives", {
        archiveSha256: createHash("sha256")
          .update(canonicalValue)
          .digest("hex"),
        byteLength: Buffer.byteLength(canonicalValue),
        contentStateHash: "1".repeat(64),
        createdAt: NOW,
        runtimeSchemaFingerprint: "2".repeat(64),
        storageId: canonicalId,
      })
    );

    vi.setSystemTime(NOW + CONTENT_RUNTIME_ARCHIVE_ORPHAN_GRACE_MS + 2000);
    const recentId = await store(
      target,
      "recent-upload",
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );
    const pageInputs: Record<string, unknown>[] = [];
    await target.run(() => {
      const asyncSyscall = Convex.asyncSyscall.bind(Convex);
      vi.spyOn(Convex, "asyncSyscall").mockImplementation(
        (operation, input) => {
          if (operation === "1.0/queryPage") {
            pageInputs.push(JSON.parse(input) as Record<string, unknown>);
          }
          return asyncSyscall(operation, input);
        }
      );
      return Promise.resolve();
    });

    const first = await target.mutation(
      internal.contentRelease.archive.cleanup.sweep,
      {}
    );
    expect(first).toEqual({
      archivesDeleted: 0,
      claimsDeleted: 0,
      deleted: 0,
      scanned: CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE,
    });
    expect(pageInputs).toContainEqual(
      expect.objectContaining({
        maximumRowsRead: CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE,
        pageSize: CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE,
      })
    );
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", orphanId))
    ).resolves.not.toBeNull();

    const second = await target.mutation(
      internal.contentRelease.archive.cleanup.sweep,
      {}
    );
    expect(second).toEqual({
      archivesDeleted: 0,
      claimsDeleted: 0,
      deleted: 1,
      scanned: 3,
    });
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", orphanId))
    ).resolves.toBeNull();
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", canonicalId))
    ).resolves.not.toBeNull();
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", recentId))
    ).resolves.not.toBeNull();
    await expect(
      target.run((ctx) => ctx.db.query("contentRuntimeArchiveSweeps").unique())
    ).resolves.toMatchObject({ cursor: null });
  });

  it("bounds expired lease cleanup and enforces archive age without another finalize", async () => {
    vi.useFakeTimers({ now: NOW });
    const target = createConvexTestWithBetterAuth();
    const expiredStorageId = await store(
      target,
      "expired-canonical-archive",
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );
    const retainedStorageId = await store(
      target,
      "retained-canonical-archive",
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );

    await target.run(async (ctx) => {
      const insertArchive = (
        index: number,
        storageId: Id<"_storage">,
        value: string,
        createdAt: number
      ) =>
        ctx.db.insert("contentRuntimeArchives", {
          archiveSha256: createHash("sha256").update(value).digest("hex"),
          byteLength: Buffer.byteLength(value),
          contentStateHash: index.toString(16).padStart(64, "0"),
          createdAt,
          runtimeSchemaFingerprint: "3".repeat(64),
          storageId,
        });
      await insertArchive(
        1,
        expiredStorageId,
        "expired-canonical-archive",
        NOW - ROLLBACK_RETENTION_MS - 1
      );
      await insertArchive(
        2,
        retainedStorageId,
        "retained-canonical-archive",
        NOW - ROLLBACK_RETENTION_MS + 1
      );
      for (
        let index = 0;
        index < CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE + 1;
        index += 1
      ) {
        await ctx.db.insert("contentRuntimeArchiveClaims", {
          claimId: `expired-${index}`,
          contentStateHash: (index + 10).toString(16).padStart(64, "0"),
          expiresAt: NOW - 1,
          runtimeSchemaFingerprint: "4".repeat(64),
        });
      }
      await ctx.db.insert("contentRuntimeArchiveClaims", {
        claimId: "live",
        contentStateHash: "5".repeat(64),
        expiresAt: NOW + 1,
        runtimeSchemaFingerprint: "4".repeat(64),
      });
    });

    const first = await target.mutation(
      internal.contentRelease.archive.cleanup.sweep,
      {}
    );
    expect(first).toMatchObject({
      archivesDeleted: 1,
      claimsDeleted: CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE,
    });
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", expiredStorageId))
    ).resolves.toBeNull();
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", retainedStorageId))
    ).resolves.not.toBeNull();
    await expect(
      target.run((ctx) =>
        ctx.db
          .query("contentRuntimeArchiveClaims")
          .withIndex("by_expiresAt", (query) => query.lte("expiresAt", NOW - 1))
          .collect()
      )
    ).resolves.toHaveLength(1);

    const second = await target.mutation(
      internal.contentRelease.archive.cleanup.sweep,
      {}
    );
    expect(second.claimsDeleted).toBe(1);
    await expect(
      target.run((ctx) => ctx.db.query("contentRuntimeArchiveClaims").collect())
    ).resolves.toHaveLength(1);
  });
});
