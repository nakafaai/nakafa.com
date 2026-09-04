// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE,
  CONTENT_RUNTIME_ARCHIVE_LEASE_MS,
  MAX_CONTENT_RUNTIME_ARCHIVE_BYTES,
} from "@repo/backend/content/archive";
import {
  CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
  CONTENT_RUNTIME_ARCHIVE_RELEASE_PATH,
  CONTENT_RUNTIME_ARCHIVE_UPLOAD_PATH,
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
  read,
  setEnvironment,
  storeArchiveFixture as store,
  write,
} from "@repo/backend/test/archive";

beforeEach(setEnvironment);

afterEach(() => {
  vi.useRealTimers();
  clearEnvironment();
});

describe("content runtime archive internals", () => {
  it("converges duplicates but rejects any digest or length identity conflict", async () => {
    const target = createConvexTestWithBetterAuth();
    const value = "canonical-runtime-archive";
    const canonicalId = await store(target, value);
    await claim(target, 1);
    await finalize(target, 1, canonicalId, value);

    const duplicateId = await store(target, value);
    const duplicate = await finalize(target, 1, duplicateId, value);
    const digestConflict = await finalize(target, 1, canonicalId, value, {
      archiveSha256: "a".repeat(64),
    });
    const lengthConflict = await finalize(target, 1, canonicalId, value, {
      byteLength: Buffer.byteLength(value) + 1,
    });

    await expect(duplicate.json()).resolves.toMatchObject({
      kind: "unchanged",
    });
    expect(digestConflict.status).toBe(409);
    expect(lengthConflict.status).toBe(409);
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", duplicateId))
    ).resolves.not.toBeNull();
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", canonicalId))
    ).resolves.not.toBeNull();
  });

  it("never reports unchanged for missing or corrupted canonical storage", async () => {
    const target = createConvexTestWithBetterAuth();
    const cases = [
      { deleted: true, name: "missing" },
      { contentType: "application/octet-stream", name: "content-type" },
      { archiveSha256: "b".repeat(64), name: "sha256" },
      { byteLength: 1, name: "size" },
    ];

    for (const [offset, testCase] of cases.entries()) {
      const index = offset + 40;
      const value = `corrupted-canonical-${testCase.name}`;
      const storageId = await store(
        target,
        value,
        testCase.contentType ?? CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
      );
      const archiveSha256 = testCase.archiveSha256 ?? hash(value);
      const byteLength = testCase.byteLength ?? Buffer.byteLength(value);
      await insert(target, index, storageId, value, {
        archiveSha256,
        byteLength,
      });
      if (testCase.deleted) {
        await target.run((ctx) => ctx.storage.delete(storageId));
      }
      if (testCase.name === "sha256") {
        await target.run((ctx) =>
          ctx.db.insert("contentRuntimeArchiveClaims", {
            ...identity(index),
            claimId: claimId(index),
            expiresAt: Date.now() + 60_000,
          })
        );
      }

      const response = await finalize(target, index, storageId, value, {
        archiveSha256,
        byteLength,
      });

      expect(response.status).toBe(testCase.name === "sha256" ? 400 : 409);
      await expect(read(target, index)).resolves.toBeNull();
      const stored = await target.run((ctx) =>
        ctx.db.system.get("_storage", storageId)
      );
      if (testCase.contentType) {
        expect(stored).not.toBeNull();
      } else {
        expect(stored).toBeNull();
      }
    }
  });

  it("replaces a stale row with a separately uploaded valid archive", async () => {
    const target = createConvexTestWithBetterAuth();
    const index = 50;
    const staleValue = "stale-runtime-archive";
    const staleId = await store(target, staleValue);
    const replacementValue = "replacement-runtime-archive";
    const replacementId = await store(target, replacementValue);
    await claim(target, index);
    await insert(target, index, staleId, staleValue, {
      archiveSha256: "d".repeat(64),
    });

    await expect(
      (await finalize(target, index, replacementId, replacementValue)).json()
    ).resolves.toMatchObject({ kind: "stored" });
    await expect(read(target, index)).resolves.toMatchObject({
      storageId: replacementId,
    });
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", staleId))
    ).resolves.toBeNull();
  });

  it("normalizes storage IDs and rejects archive metadata above the hard bound", async () => {
    const target = createConvexTestWithBetterAuth();
    const value = "bounded-runtime-archive";
    const storageId = await store(target, value);
    await claim(target, 2);

    const malformed = await finalize(target, 2, "not-a-storage-id", value);
    const oversized = await finalize(target, 2, storageId, value, {
      byteLength: MAX_CONTENT_RUNTIME_ARCHIVE_BYTES + 1,
    });

    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(400);
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", storageId))
    ).resolves.not.toBeNull();
  });

  it("defers every unproven stored upload to bounded cleanup", async () => {
    const target = createConvexTestWithBetterAuth();
    const cases = [
      { contentType: CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE, deleted: true },
      { contentType: "application/octet-stream" },
      {
        contentType: CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE,
        overrides: { archiveSha256: "b".repeat(64) },
      },
      {
        contentType: CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE,
        overrides: { byteLength: 1 },
      },
    ];

    for (const [offset, testCase] of cases.entries()) {
      const index = offset + 10;
      const value = `invalid-runtime-archive-${index}`;
      const storageId = await store(target, value, testCase.contentType);
      await claim(target, index);
      if (testCase.deleted) {
        await target.run((ctx) => ctx.storage.delete(storageId));
      }
      const response = await finalize(
        target,
        index,
        storageId,
        value,
        testCase.overrides
      );
      expect(response.status).toBe(400);
      const stored = await target.run((ctx) =>
        ctx.db.system.get("_storage", storageId)
      );
      if (testCase.deleted) {
        expect(stored).toBeNull();
      } else {
        expect(stored).not.toBeNull();
      }
    }

    const unclaimedValue = "unclaimed-runtime-archive";
    const unclaimedId = await store(target, unclaimedValue);
    const unclaimed = await finalize(target, 20, unclaimedId, unclaimedValue);
    expect(unclaimed.status).toBe(409);
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", unclaimedId))
    ).resolves.not.toBeNull();
  });

  it("serializes concurrent claims and recovers expired leases", async () => {
    const target = createConvexTestWithBetterAuth();
    const archiveIdentity = identity(1);
    const firstId = claimId(1);
    const secondId = claimId(2);
    const requestClaim = (id: string) =>
      write(target, CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH, {
        ...archiveIdentity,
        claimId: id,
      });
    const responses = await Promise.all([
      requestClaim(firstId),
      requestClaim(secondId),
    ]);
    const results = await Promise.all(
      responses.map((response) => response.json())
    );
    const ownerIndex = results.findIndex(
      (result) => (result as { kind?: string }).kind === "claimed"
    );
    const ownerId = ownerIndex === 0 ? firstId : secondId;
    const blockedId = ownerIndex === 0 ? secondId : firstId;

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(
      results.map((result) => (result as { kind: string }).kind).sort()
    ).toEqual(["busy", "claimed"]);
    await expect(
      write(target, CONTENT_RUNTIME_ARCHIVE_UPLOAD_PATH, {
        ...archiveIdentity,
        claimId: blockedId,
      })
    ).resolves.toMatchObject({ status: 409 });
    await expect(
      write(target, CONTENT_RUNTIME_ARCHIVE_UPLOAD_PATH, {
        ...archiveIdentity,
        claimId: ownerId,
      })
    ).resolves.toMatchObject({ status: 200 });
    const released = await write(target, CONTENT_RUNTIME_ARCHIVE_RELEASE_PATH, {
      ...archiveIdentity,
      claimId: ownerId,
    });
    expect(await released.json()).toEqual({ released: true });

    await requestClaim(firstId);
    await target.run(async (ctx) => {
      const lease = await ctx.db.query("contentRuntimeArchiveClaims").unique();
      if (lease) {
        await ctx.db.patch(lease._id, { expiresAt: Date.now() - 1 });
      }
    });
    await expect(
      requestClaim(secondId).then((response) => response.json())
    ).resolves.toMatchObject({ kind: "claimed" });
    const claimedAt = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(claimedAt);
    await expect(
      write(target, CONTENT_RUNTIME_ARCHIVE_UPLOAD_PATH, {
        ...archiveIdentity,
        claimId: secondId,
      })
    ).resolves.toMatchObject({ status: 200 });
    vi.setSystemTime(claimedAt + CONTENT_RUNTIME_ARCHIVE_LEASE_MS + 1000);
    await expect(
      write(target, CONTENT_RUNTIME_ARCHIVE_UPLOAD_PATH, {
        ...archiveIdentity,
        claimId: secondId,
      })
    ).resolves.toMatchObject({ status: 409 });
    const staleRelease = await write(
      target,
      CONTENT_RUNTIME_ARCHIVE_RELEASE_PATH,
      { ...archiveIdentity, claimId: firstId }
    );
    expect(await staleRelease.json()).toEqual({ released: false });
  });
});
