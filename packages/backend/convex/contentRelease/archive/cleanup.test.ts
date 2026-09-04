// @vitest-environment node

import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE } from "@repo/backend/content/archive";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE } from "@repo/backend/convex/contentRelease/archive/spec";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { storeArchiveFixture } from "@repo/backend/test/archive";

const NOW = 1_800_000_000_000;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("content runtime archive cleanup", () => {
  it("bounds expired lease cleanup and enforces archive age without another finalize", async () => {
    vi.useFakeTimers({ now: NOW });
    const target = createConvexTestWithBetterAuth();
    const unownedStorageId = await storeArchiveFixture(
      target,
      "unowned-archive-mime",
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );
    const expiredStorageId = await storeArchiveFixture(
      target,
      "expired-canonical-archive",
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );
    const retainedStorageId = await storeArchiveFixture(
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
          createdAt,
          runtimeSelectionHash: index.toString(16).padStart(64, "0"),
          runtimeSchemaFingerprint: "3".repeat(64),
          sourceStateHash: "6".repeat(64),
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
      await insertArchive(
        3,
        retainedStorageId,
        "retained-canonical-archive",
        NOW - ROLLBACK_RETENTION_MS - 1
      );
      for (
        let index = 0;
        index < CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE + 1;
        index += 1
      ) {
        await ctx.db.insert("contentRuntimeArchiveClaims", {
          claimId: `expired-${index}`,
          expiresAt: NOW - 1,
          runtimeSelectionHash: (index + 10).toString(16).padStart(64, "0"),
          runtimeSchemaFingerprint: "4".repeat(64),
        });
      }
      await ctx.db.insert("contentRuntimeArchiveClaims", {
        claimId: "live",
        expiresAt: NOW + 1,
        runtimeSelectionHash: "5".repeat(64),
        runtimeSchemaFingerprint: "4".repeat(64),
      });
    });

    const first = await target.mutation(
      internal.contentRelease.archive.cleanup.sweep,
      {}
    );
    expect(first).toMatchObject({
      archivesDeleted: 2,
      claimsDeleted: CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE,
    });
    expect(Object.keys(first).sort()).toEqual([
      "archivesDeleted",
      "claimsDeleted",
    ]);
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", unownedStorageId))
    ).resolves.not.toBeNull();
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
