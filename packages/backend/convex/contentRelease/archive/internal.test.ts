// @vitest-environment node

import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE,
  MAX_CONTENT_RUNTIME_ARCHIVE_BYTES,
} from "@repo/backend/content/archive";
import {
  CONTENT_RUNTIME_ARCHIVE_ABORT_PATH,
  CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
  CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH,
} from "@repo/backend/content/endpoint";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { storeArchiveFixture } from "@repo/backend/test/archive";

const ARCHIVE_TOKEN = "technical-archive-token";
const archiveTokenName = "CONTENT_ARCHIVE_TOKEN";
const runtimeTokenName = "CONTENT_RUNTIME_TOKEN";
const polarName = "POLAR_WEBHOOK_SECRET";
type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;

function identity(index: number) {
  return {
    runtimeSelectionHash: index.toString(16).padStart(64, "0"),
    runtimeSchemaFingerprint: "f".repeat(64),
  };
}

function sourceStateHash(index: number) {
  return (index + 1000).toString(16).padStart(64, "0");
}

function claimId(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
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

function claim(target: RuntimeTest, index: number) {
  return write(target, CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH, {
    ...identity(index),
    claimId: claimId(index),
  });
}

function store(target: RuntimeTest, value: string, contentType: string) {
  return storeArchiveFixture(target, value, contentType);
}

function finalize(
  target: RuntimeTest,
  index: number,
  storageId: string,
  value: string,
  overrides: Record<string, unknown> = {}
) {
  return write(target, CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH, {
    ...identity(index),
    archiveSha256: sha256(value),
    byteLength: Buffer.byteLength(value),
    claimId: claimId(index),
    sourceStateHash: sourceStateHash(index),
    storageId,
    ...overrides,
  });
}

function abort(target: RuntimeTest, index: number, storageId: string) {
  return write(target, CONTENT_RUNTIME_ARCHIVE_ABORT_PATH, {
    ...identity(index),
    claimId: claimId(index),
    storageId,
  });
}

function insertCanonical(
  target: RuntimeTest,
  index: number,
  storageId: Id<"_storage">,
  value: string,
  overrides: {
    readonly archiveSha256?: string;
    readonly byteLength?: number;
  } = {}
) {
  return target.run((ctx) =>
    ctx.db.insert("contentRuntimeArchives", {
      ...identity(index),
      archiveSha256: overrides.archiveSha256 ?? sha256(value),
      byteLength: overrides.byteLength ?? Buffer.byteLength(value),
      createdAt: Date.now(),
      sourceStateHash: sourceStateHash(index),
      storageId,
    })
  );
}

function readCanonical(target: RuntimeTest, index: number) {
  return target.run((ctx) =>
    ctx.db
      .query("contentRuntimeArchives")
      .withIndex(
        "by_runtimeSelectionHash_and_runtimeSchemaFingerprint",
        (query) =>
          query
            .eq("runtimeSelectionHash", identity(index).runtimeSelectionHash)
            .eq(
              "runtimeSchemaFingerprint",
              identity(index).runtimeSchemaFingerprint
            )
      )
      .unique()
  );
}

beforeEach(() => {
  process.env[archiveTokenName] = ARCHIVE_TOKEN;
  process.env[runtimeTokenName] = "technical-runtime-token";
  process.env[polarName] = "technical-webhook-secret";
});

afterEach(() => {
  delete process.env[archiveTokenName];
  delete process.env[runtimeTokenName];
  delete process.env[polarName];
});

describe("content runtime archive mutation boundary", () => {
  it("converges duplicates but rejects any digest or length identity conflict", async () => {
    const target = createConvexTestWithBetterAuth();
    const value = "canonical-runtime-archive";
    const canonicalId = await store(
      target,
      value,
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );
    await claim(target, 1);
    await finalize(target, 1, canonicalId, value);

    const duplicateId = await store(
      target,
      value,
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );
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
      const archiveSha256 = testCase.archiveSha256 ?? sha256(value);
      const byteLength = testCase.byteLength ?? Buffer.byteLength(value);
      await insertCanonical(target, index, storageId, value, {
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
      await expect(readCanonical(target, index)).resolves.toBeNull();
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
    const staleId = await store(
      target,
      staleValue,
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );
    const replacementValue = "replacement-runtime-archive";
    const replacementId = await store(
      target,
      replacementValue,
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );
    await claim(target, index);
    await insertCanonical(target, index, staleId, staleValue, {
      archiveSha256: "d".repeat(64),
    });

    await expect(
      (await finalize(target, index, replacementId, replacementValue)).json()
    ).resolves.toMatchObject({ kind: "stored" });
    await expect(readCanonical(target, index)).resolves.toMatchObject({
      storageId: replacementId,
    });
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", staleId))
    ).resolves.toBeNull();
  });

  it("normalizes storage IDs and rejects archive metadata above the hard bound", async () => {
    const target = createConvexTestWithBetterAuth();
    const value = "bounded-runtime-archive";
    const storageId = await store(
      target,
      value,
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );
    await claim(target, 2);

    const malformed = await finalize(target, 2, "not-a-storage-id", value);
    const oversized = await finalize(target, 2, storageId, value, {
      byteLength: MAX_CONTENT_RUNTIME_ARCHIVE_BYTES + 1,
    });
    const malformedAbort = await write(
      target,
      CONTENT_RUNTIME_ARCHIVE_ABORT_PATH,
      {
        ...identity(2),
        claimId: claimId(2),
        storageId: "not-a-storage-id",
      }
    );
    const cleanup = await write(target, CONTENT_RUNTIME_ARCHIVE_ABORT_PATH, {
      ...identity(2),
      claimId: claimId(2),
      storageId,
    });

    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(malformedAbort.status).toBe(400);
    await expect(cleanup.json()).resolves.toEqual({ kind: "deferred" });
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
    const unclaimedId = await store(
      target,
      unclaimedValue,
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );
    const unclaimed = await finalize(target, 20, unclaimedId, unclaimedValue);
    expect(unclaimed.status).toBe(409);
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", unclaimedId))
    ).resolves.not.toBeNull();
  });

  it("never deletes foreign or another identity's canonical storage", async () => {
    const target = createConvexTestWithBetterAuth();
    const foreignValue = "foreign-storage";
    const foreignId = await store(
      target,
      foreignValue,
      "application/octet-stream"
    );
    const canonicalValue = "other-identity-canonical";
    const canonicalId = await store(
      target,
      canonicalValue,
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );
    await claim(target, 60);
    await finalize(target, 60, canonicalId, canonicalValue);

    let index = 61;
    for (const candidate of [
      { storageId: foreignId, value: foreignValue },
      { storageId: canonicalId, value: canonicalValue },
    ]) {
      for (const operation of ["finalize", "abort"] as const) {
        for (const claimState of ["missing", "expired"] as const) {
          if (claimState === "expired") {
            await target.run((ctx) =>
              ctx.db.insert("contentRuntimeArchiveClaims", {
                ...identity(index),
                claimId: claimId(index),
                expiresAt: Date.now() - 1,
              })
            );
          }
          const response =
            operation === "finalize"
              ? await finalize(
                  target,
                  index,
                  candidate.storageId,
                  candidate.value
                )
              : await abort(target, index, candidate.storageId);
          expect(response.status).toBe(operation === "finalize" ? 409 : 200);
          index += 1;
        }
      }
    }

    await claim(target, index);
    expect(
      (await finalize(target, index, canonicalId, canonicalValue)).status
    ).toBe(409);
    await expect(readCanonical(target, index)).resolves.toBeNull();
    await expect(readCanonical(target, 60)).resolves.not.toBeNull();
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", foreignId))
    ).resolves.not.toBeNull();
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", canonicalId))
    ).resolves.not.toBeNull();
  });

  it("repairs corrupt canonical rows during abort without false convergence", async () => {
    const target = createConvexTestWithBetterAuth();
    const cases = [
      { deleted: true, kind: "deferred", name: "missing" },
      {
        contentType: "application/octet-stream",
        kind: "deferred",
        name: "content-type",
      },
      { archiveSha256: "c".repeat(64), kind: "deleted", name: "sha256" },
      { byteLength: 1, kind: "deferred", name: "size" },
    ];

    for (const [offset, testCase] of cases.entries()) {
      const index = offset + 80;
      const value = `abort-corrupt-${testCase.name}`;
      const storageId = await store(
        target,
        value,
        testCase.contentType ?? CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
      );
      await insertCanonical(target, index, storageId, value, testCase);
      if (testCase.deleted) {
        await target.run((ctx) => ctx.storage.delete(storageId));
      }
      const abortStorageId =
        testCase.name === "size"
          ? await store(
              target,
              "unproven-abort-candidate",
              CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
            )
          : storageId;

      await expect(
        (await abort(target, index, abortStorageId)).json()
      ).resolves.toEqual({ kind: testCase.kind });
      await expect(readCanonical(target, index)).resolves.toBeNull();
      const stored = await target.run((ctx) =>
        ctx.db.system.get("_storage", storageId)
      );
      if (testCase.contentType) {
        expect(stored).not.toBeNull();
      } else {
        expect(stored).toBeNull();
      }
      if (abortStorageId !== storageId) {
        await expect(
          target.run((ctx) => ctx.db.system.get("_storage", abortStorageId))
        ).resolves.not.toBeNull();
      }
    }
  });

  it("defers uncertain duplicates and preserves canonical storage", async () => {
    const target = createConvexTestWithBetterAuth();
    const value = "uncertain-finalization-runtime-archive";
    const storageId = await store(
      target,
      value,
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );
    await claim(target, 30);
    await finalize(target, 30, storageId, value);
    const duplicateId = await store(
      target,
      value,
      CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
    );

    await expect(
      (await abort(target, 30, duplicateId)).json()
    ).resolves.toEqual({ kind: "deferred" });
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", duplicateId))
    ).resolves.not.toBeNull();

    const aborted = await abort(target, 30, storageId);

    await expect(aborted.json()).resolves.toMatchObject({ kind: "canonical" });
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", storageId))
    ).resolves.not.toBeNull();
  });
});
