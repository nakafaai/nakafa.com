// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE } from "@repo/backend/content/archive";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  abort,
  claim,
  claimId,
  clearEnvironment,
  finalize,
  identity,
  insert,
  read,
  setEnvironment,
  storeArchiveFixture as store,
} from "@repo/backend/test/archive";

beforeEach(setEnvironment);
afterEach(clearEnvironment);

describe("content runtime archive model", () => {
  it("preserves another identity's pending archive through finalize and abort", async () => {
    const target = createConvexTestWithBetterAuth();
    const pendingIndex = 70;
    const value = "pending-other-identity-archive";
    const storageId = await store(target, value);
    await claim(target, pendingIndex);

    for (const [offset, attack] of [
      { claimState: "missing", operation: "finalize" },
      { claimState: "expired", operation: "finalize" },
      { claimState: "missing", operation: "abort" },
      { claimState: "expired", operation: "abort" },
    ].entries()) {
      const index = offset + 71;
      if (attack.claimState === "expired") {
        await target.run((ctx) =>
          ctx.db.insert("contentRuntimeArchiveClaims", {
            ...identity(index),
            claimId: claimId(index),
            expiresAt: Date.now() - 1,
          })
        );
      }

      const response =
        attack.operation === "finalize"
          ? await finalize(target, index, storageId, value)
          : await abort(target, index, storageId);

      expect(response.status).toBe(attack.operation === "finalize" ? 409 : 200);
      if (attack.operation === "abort") {
        await expect(response.json()).resolves.toEqual({ kind: "deferred" });
      }
      await expect(
        target.run((ctx) => ctx.db.system.get("_storage", storageId))
      ).resolves.not.toBeNull();
    }

    await expect(
      (await finalize(target, pendingIndex, storageId, value)).json()
    ).resolves.toMatchObject({ kind: "stored" });
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
    const canonicalId = await store(target, canonicalValue);
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
    await expect(read(target, index)).resolves.toBeNull();
    await expect(read(target, 60)).resolves.not.toBeNull();
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", foreignId))
    ).resolves.not.toBeNull();
    await expect(
      target.run((ctx) => ctx.db.system.get("_storage", canonicalId))
    ).resolves.not.toBeNull();
  });

  it("repairs corrupt canonical rows during abort without false convergence", async () => {
    const target = createConvexTestWithBetterAuth();
    expect((await abort(target, 80, "not-a-storage-id")).status).toBe(400);
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
      await insert(target, index, storageId, value, testCase);
      if (testCase.deleted) {
        await target.run((ctx) => ctx.storage.delete(storageId));
      }
      const abortStorageId =
        testCase.name === "size"
          ? await store(target, "unproven-abort-candidate")
          : storageId;

      await expect(
        (await abort(target, index, abortStorageId)).json()
      ).resolves.toEqual({ kind: testCase.kind });
      await expect(read(target, index)).resolves.toBeNull();
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
    const storageId = await store(target, value);
    await claim(target, 30);
    await finalize(target, 30, storageId, value);
    const duplicateId = await store(target, value);

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
