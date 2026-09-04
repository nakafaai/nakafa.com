// @vitest-environment node

import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE,
  CONTENT_RUNTIME_ARCHIVE_LEASE_MS,
} from "@repo/backend/content/archive";
import {
  CONTENT_RUNTIME_ARCHIVE_ABORT_PATH,
  CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
  CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
  CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH,
  CONTENT_RUNTIME_ARCHIVE_RELEASE_PATH,
  CONTENT_RUNTIME_ARCHIVE_UPLOAD_PATH,
} from "@repo/backend/content/endpoint";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { storeArchiveFixture } from "@repo/backend/test/archive";

const RUNTIME_TOKEN = "technical-runtime-token";
const ARCHIVE_TOKEN = "technical-archive-token";
const runtimeTokenName = "CONTENT_RUNTIME_TOKEN";
const archiveTokenName = "CONTENT_ARCHIVE_TOKEN";
const polarName = "POLAR_WEBHOOK_SECRET";
const identity = {
  contentStateHash: "1".repeat(64),
  runtimeSchemaFingerprint: "2".repeat(64),
};

type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;

function claimId(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function post(
  target: RuntimeTest,
  path: string,
  body: BodyInit | null,
  access: "read" | "write",
  contentType = "application/json"
) {
  return target.fetch(path, {
    body,
    headers: {
      "content-type": contentType,
      [access === "read" ? "x-nakafa-content-token" : "x-nakafa-archive-token"]:
        access === "read" ? RUNTIME_TOKEN : ARCHIVE_TOKEN,
    },
    method: "POST",
  });
}

function write(target: RuntimeTest, path: string, body: unknown) {
  return post(target, path, JSON.stringify(body), "write");
}

function claim(target: RuntimeTest, id: string, archiveIdentity = identity) {
  return write(target, CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH, {
    ...archiveIdentity,
    claimId: id,
  });
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function storeArchive(
  target: RuntimeTest,
  value: string,
  contentType = CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
) {
  return storeArchiveFixture(target, value, contentType);
}

function finalize(
  target: RuntimeTest,
  id: string,
  storageId: string,
  value: string,
  archiveIdentity = identity
) {
  return write(target, CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH, {
    ...archiveIdentity,
    archiveSha256: sha256(value),
    byteLength: Buffer.byteLength(value),
    claimId: id,
    storageId,
  });
}

beforeEach(() => {
  process.env[runtimeTokenName] = RUNTIME_TOKEN;
  process.env[archiveTokenName] = ARCHIVE_TOKEN;
  process.env[polarName] = "technical-webhook-secret";
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env[runtimeTokenName];
  delete process.env[archiveTokenName];
  delete process.env[polarName];
});

describe("content runtime archive HTTP routes", () => {
  it("preserves existing discovery and authentication routes", async () => {
    const target = createConvexTestWithBetterAuth();
    const discovery = await target.fetch("/.well-known/openid-configuration", {
      redirect: "manual",
    });
    const session = await target.fetch("/api/auth/get-session");

    expect(discovery.status).toBe(302);
    expect(discovery.headers.get("location")).toBe(
      "/api/auth/convex/.well-known/openid-configuration"
    );
    expect(session.status).toBe(200);
  });

  it("keeps read and producer credentials least-privileged before body reads", async () => {
    const target = createConvexTestWithBetterAuth();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls += 1;
          controller.error(new Error("Unauthorized body was consumed."));
        },
      },
      { highWaterMark: 0 }
    );
    const readCredentialOnWriteRoute = await target.fetch(
      CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
      {
        body,
        duplex: "half",
        headers: {
          "content-type": "application/json",
          "x-nakafa-content-token": RUNTIME_TOKEN,
        },
        method: "POST",
      } as RequestInit & { readonly duplex: "half" }
    );
    const writeCredentialOnReadRoute = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
      JSON.stringify(identity),
      "write"
    );

    expect(readCredentialOnWriteRoute.status).toBe(401);
    expect(writeCredentialOnReadRoute.status).toBe(401);
    expect(pulls).toBe(0);
  });

  it("fails closed on cryptographic and bounded-body failures", async () => {
    const target = createConvexTestWithBetterAuth();
    vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(
      new Error("digest unavailable")
    );
    const cryptoFailure = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
      JSON.stringify(identity),
      "read"
    );
    const oversized = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
      JSON.stringify({ source: "x".repeat(3000) }),
      "write"
    );
    const unsupported = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
      JSON.stringify(identity),
      "write",
      "text/plain"
    );
    const malformed = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
      "{",
      "write"
    );
    const invalidEncoding = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
      new Uint8Array([0xff]),
      "write"
    );
    await target.run(async (ctx) => {
      const expiresAt = Date.now() + 60_000;
      await ctx.db.insert("contentRuntimeArchiveClaims", {
        ...identity,
        claimId: claimId(90),
        expiresAt,
      });
      await ctx.db.insert("contentRuntimeArchiveClaims", {
        ...identity,
        claimId: claimId(91),
        expiresAt,
      });
    });
    const internalFailure = await claim(target, claimId(92));

    expect(cryptoFailure.status).toBe(500);
    expect(oversized.status).toBe(413);
    expect(unsupported.status).toBe(415);
    expect(malformed.status).toBe(400);
    expect(invalidEncoding.status).toBe(400);
    expect(internalFailure.status).toBe(500);
    await expect(internalFailure.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_ARCHIVE_INTERNAL",
    });
  });

  it("serializes concurrent claims and recovers expired leases", async () => {
    const target = createConvexTestWithBetterAuth();
    const firstId = claimId(1);
    const secondId = claimId(2);
    const responses = await Promise.all([
      claim(target, firstId),
      claim(target, secondId),
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
        ...identity,
        claimId: blockedId,
      })
    ).resolves.toMatchObject({ status: 409 });
    await expect(
      write(target, CONTENT_RUNTIME_ARCHIVE_UPLOAD_PATH, {
        ...identity,
        claimId: ownerId,
      })
    ).resolves.toMatchObject({ status: 200 });
    const released = await write(target, CONTENT_RUNTIME_ARCHIVE_RELEASE_PATH, {
      ...identity,
      claimId: ownerId,
    });
    expect(await released.json()).toEqual({ released: true });

    await claim(target, firstId);
    await target.run(async (ctx) => {
      const lease = await ctx.db.query("contentRuntimeArchiveClaims").unique();
      if (lease) {
        await ctx.db.patch(lease._id, { expiresAt: Date.now() - 1 });
      }
    });
    await expect(
      claim(target, secondId).then((response) => response.json())
    ).resolves.toMatchObject({
      kind: "claimed",
    });
    const claimedAt = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(claimedAt);
    await expect(
      write(target, CONTENT_RUNTIME_ARCHIVE_UPLOAD_PATH, {
        ...identity,
        claimId: secondId,
      })
    ).resolves.toMatchObject({ status: 200 });
    vi.setSystemTime(claimedAt + CONTENT_RUNTIME_ARCHIVE_LEASE_MS + 1000);
    await expect(
      write(target, CONTENT_RUNTIME_ARCHIVE_UPLOAD_PATH, {
        ...identity,
        claimId: secondId,
      })
    ).resolves.toMatchObject({ status: 409 });
    const staleRelease = await write(
      target,
      CONTENT_RUNTIME_ARCHIVE_RELEASE_PATH,
      { ...identity, claimId: firstId }
    );
    expect(await staleRelease.json()).toEqual({ released: false });
  });

  it("preserves another identity's pending archive through finalize and abort", async () => {
    const target = createConvexTestWithBetterAuth();
    const pendingIdentity = {
      contentStateHash: "7".repeat(64),
      runtimeSchemaFingerprint: "6".repeat(64),
    };
    const pendingClaimId = claimId(70);
    const value = "pending-other-identity-archive";
    const storageId = await storeArchive(target, value);
    await claim(target, pendingClaimId, pendingIdentity);

    for (const [offset, attack] of [
      { claimState: "missing", operation: "finalize" },
      { claimState: "expired", operation: "finalize" },
      { claimState: "missing", operation: "abort" },
      { claimState: "expired", operation: "abort" },
    ].entries()) {
      const index = offset + 71;
      const attackerIdentity = {
        contentStateHash: index.toString(16).padStart(64, "0"),
        runtimeSchemaFingerprint: "5".repeat(64),
      };
      const attackerClaimId = claimId(index);
      if (attack.claimState === "expired") {
        await target.run((ctx) =>
          ctx.db.insert("contentRuntimeArchiveClaims", {
            ...attackerIdentity,
            claimId: attackerClaimId,
            expiresAt: Date.now() - 1,
          })
        );
      }

      const response =
        attack.operation === "finalize"
          ? await finalize(
              target,
              attackerClaimId,
              storageId,
              value,
              attackerIdentity
            )
          : await write(target, CONTENT_RUNTIME_ARCHIVE_ABORT_PATH, {
              ...attackerIdentity,
              claimId: attackerClaimId,
              storageId,
            });

      expect(response.status).toBe(attack.operation === "finalize" ? 409 : 200);
      if (attack.operation === "abort") {
        await expect(response.json()).resolves.toEqual({ kind: "deferred" });
      }
      await expect(
        target.run((ctx) => ctx.db.system.get("_storage", storageId))
      ).resolves.not.toBeNull();
    }

    await expect(
      (
        await finalize(
          target,
          pendingClaimId,
          storageId,
          value,
          pendingIdentity
        )
      ).json()
    ).resolves.toMatchObject({ kind: "stored" });
  });

  it("binds one archive and returns metadata with one download capability", async () => {
    const target = createConvexTestWithBetterAuth();
    const id = claimId(3);
    const value = "encrypted-runtime-archive";
    const storageId = await storeArchive(target, value);
    await claim(target, id);

    const stored = await finalize(target, id, storageId, value);
    const repeated = await finalize(target, id, storageId, value);
    const download = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
      JSON.stringify(identity),
      "read"
    );
    const existingClaim = await claim(target, claimId(4));

    expect(stored.status).toBe(200);
    await expect(stored.json()).resolves.toMatchObject({ kind: "stored" });
    await expect(repeated.json()).resolves.toMatchObject({ kind: "unchanged" });
    await expect(download.json()).resolves.toMatchObject({
      ...identity,
      archiveSha256: sha256(value),
      byteLength: Buffer.byteLength(value),
      downloadUrl: expect.stringContaining("/api/storage/"),
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
    const absentIdentity = {
      contentStateHash: "9".repeat(64),
      runtimeSchemaFingerprint: "8".repeat(64),
    };
    const absent = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
      JSON.stringify(absentIdentity),
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
      const archiveIdentity = {
        contentStateHash: index.toString(16).padStart(64, "0"),
        runtimeSchemaFingerprint: "c".repeat(64),
      };
      const value = `stale-runtime-archive-${index}`;
      const storageId = await storeArchive(target, value, testCase.contentType);
      await target.run((ctx) =>
        ctx.db.insert("contentRuntimeArchives", {
          ...archiveIdentity,
          archiveSha256: testCase.archiveSha256 ?? sha256(value),
          byteLength: testCase.byteLength ?? Buffer.byteLength(value),
          createdAt: Date.now(),
          storageId,
        })
      );
      if (testCase.deleted) {
        await target.run((ctx) => ctx.storage.delete(storageId));
      }

      const missing = await post(
        target,
        CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
        JSON.stringify(archiveIdentity),
        "read"
      );
      const reclaimed = await claim(target, claimId(index), archiveIdentity);

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
