// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { api, internal } from "@repo/backend/convex/_generated/api";
import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import {
  FORUM_PENDING_UPLOAD_EXPIRATION_MS,
  FORUM_PENDING_UPLOAD_LEASE_MS,
} from "@repo/backend/convex/classes/forums/attachments/constants";
import { registerForumAttachmentUploadRoute } from "@repo/backend/convex/classes/forums/attachments/route";
import { MAX_FORUM_ATTACHMENT_BYTES } from "@repo/backend/convex/classes/forums/utils/constants";
import {
  insertClass,
  insertClassMembership,
  insertSchool,
  insertSchoolMembership,
} from "@repo/backend/convex/classes/test.helpers";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { getFunctionName } from "convex/server";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Schema } from "effect";
import { Hono } from "hono";

const NOW = Date.UTC(2026, 4, 29, 15, 0, 0);
const LEASE_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const uploadTokenSuffixPattern = /[^/]+$/;

/** Seeds one authenticated teacher and an open forum for HTTP upload tests. */
const seedOpenForum = Effect.fn("test.forumAttachments.seedOpenForum")(
  (ctx: MutationCtx) =>
    Effect.promise(async () => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "forum-upload-route",
      });
      const ownership = { now: NOW, userId: user.userId };
      const schoolId = await insertSchool(ctx, ownership);
      const classId = await insertClass(ctx, { ...ownership, schoolId });
      const membership = {
        ...ownership,
        role: "teacher",
        schoolId,
      } satisfies Parameters<typeof insertSchoolMembership>[1];
      await insertSchoolMembership(ctx, membership);
      await insertClassMembership(ctx, { ...membership, classId });
      const forumId = await ctx.db.insert("schoolClassForums", {
        body: "Attachment forum body",
        classId,
        createdBy: user.userId,
        isPinned: false,
        lastPostAt: NOW,
        lastPostBy: user.userId,
        nextPostSequence: 1,
        postCount: 0,
        reactionCounts: [],
        schoolId,
        status: "open",
        tag: "general",
        title: "Attachment forum",
        updatedAt: NOW,
      });
      return { ...user, forumId };
    })
);

const createPendingUpload = Effect.fn(
  "test.forumAttachments.createPendingUpload"
)(function* () {
  const t = createConvexTestWithBetterAuth();
  const seeded = yield* Effect.promise(() =>
    t.mutation((ctx) => runConvexProgram(seedOpenForum(ctx)))
  );
  const owner = t.withIdentity({
    sessionId: seeded.sessionId,
    subject: seeded.authUserId,
  });
  const upload = yield* Effect.promise(() =>
    owner.mutation(api.classes.forums.mutations.uploads.generateUploadUrl, {
      forumId: seeded.forumId,
    })
  );
  const capability = new URL(upload.uploadUrl);
  const uploadToken = yield* Schema.decodeUnknownEffect(Schema.NonEmptyString)(
    capability.pathname.split("/").at(-1)
  );
  return {
    capabilityPath: capability.pathname,
    owner,
    seeded,
    t,
    uploadId: upload.uploadId,
    uploadToken,
  };
});

type PendingUpload = Effect.Success<ReturnType<typeof createPendingUpload>>;

const claimPendingUpload = Effect.fn(
  "test.forumAttachments.claimPendingUpload"
)(function* (pendingUpload: PendingUpload, leaseId = LEASE_ID) {
  return yield* Effect.promise(() =>
    pendingUpload.t.mutation(internal.classes.forums.attachments.upload.claim, {
      leaseId,
      uploadId: pendingUpload.uploadId,
      uploadToken: pendingUpload.uploadToken,
    })
  );
});

function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("POLAR_WEBHOOK_SECRET", "technical-webhook-secret");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("classes/forums/attachments/route", () => {
  it.effect.each([
    { siteOrigin: "http://localhost:3000", bodyText: "hello" },
    { siteOrigin: "https://local.nakafa.com", bodyText: "hello" },
    { siteOrigin: "http://localhost:3000", bodyText: undefined },
  ])(
    "stores, binds, and finalizes $bodyText from $siteOrigin",
    ({ siteOrigin, bodyText }) =>
      Effect.gen(function* () {
        vi.stubEnv("SITE_URL", siteOrigin);
        const bodySize = bodyText?.length ?? 0;
        const { capabilityPath, owner, t, uploadId } =
          yield* createPendingUpload();
        const response = yield* Effect.promise(() =>
          t.fetch(capabilityPath, {
            body: bodyText,
            headers: {
              "content-type": "text/plain",
              origin: siteOrigin,
            },
            method: "POST",
          })
        );
        expect(response.status).toBe(200);
        expectPrivate(response);
        expect(response.headers.get("access-control-allow-origin")).toBe(
          siteOrigin
        );
        const responseBody = yield* Effect.promise(() => response.json());
        const body = yield* Schema.decodeUnknownEffect(
          Schema.Struct({ storageId: Schema.String })
        )(responseBody);
        const boundUpload = yield* Effect.promise(() =>
          t.query((ctx) =>
            ctx.db.get("schoolClassForumPendingUploads", uploadId)
          )
        );
        const storageId = yield* Effect.fromNullishOr(boundUpload?.storageId);
        expect(body.storageId).toBe(storageId);
        const savedUploadId = yield* Effect.promise(() =>
          owner.mutation(api.classes.forums.mutations.uploads.saveForumUpload, {
            name: "notes.txt",
            size: bodySize,
            storageId,
            type: "text/plain",
            uploadId,
          })
        );
        expect(savedUploadId).toBe(uploadId);
        const state = yield* Effect.promise(() =>
          t.query(async (ctx) => {
            const pendingUpload = await ctx.db.get(
              "schoolClassForumPendingUploads",
              uploadId
            );
            return {
              pendingUpload,
              storageMetadata: pendingUpload?.storageId
                ? await ctx.db.system.get("_storage", pendingUpload.storageId)
                : null,
            };
          })
        );
        expect(state.pendingUpload).toMatchObject({
          mimeType: "text/plain",
          name: "notes.txt",
          size: bodySize,
          storageId: body.storageId,
        });
        expect(state.storageMetadata).toMatchObject({ size: bodySize });
      })
  );
  it.effect.each(["wrong-token", "leased", "expired"])(
    "rejects a %s capability before consuming its hostile body",
    (state) =>
      Effect.gen(function* () {
        const pending = yield* createPendingUpload();
        const { capabilityPath, t, uploadId } = pending;
        if (state === "leased") {
          expect(yield* claimPendingUpload(pending)).toBe(true);
        } else if (state === "expired") {
          vi.setSystemTime(NOW + FORUM_PENDING_UPLOAD_EXPIRATION_MS);
        }
        const path =
          state === "wrong-token"
            ? capabilityPath.replace(uploadTokenSuffixPattern, "wrong-token")
            : capabilityPath;
        let pulls = 0;
        const request = {
          body: new ReadableStream<Uint8Array>(
            {
              pull(controller) {
                pulls += 1;
                controller.error(new Error("Unauthorized body was consumed."));
              },
            },
            { highWaterMark: 0 }
          ),
          duplex: "half",
          headers: { "content-type": "text/plain" },
          method: "POST",
        } satisfies RequestInit & { readonly duplex: "half" };
        const response = yield* Effect.promise(() => t.fetch(path, request));
        expect(response.status).toBe(404);
        expectPrivate(response);
        expect(pulls).toBe(0);
        expect(yield* Effect.promise(() => response.json())).toEqual({
          code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
        });
        const upload = yield* Effect.promise(() =>
          t.query((ctx) =>
            ctx.db.get("schoolClassForumPendingUploads", uploadId)
          )
        );
        expect(upload).not.toBeNull();
        if (state === "leased") {
          expect(upload).toMatchObject({
            uploadLease: {
              expiresAt: NOW + FORUM_PENDING_UPLOAD_LEASE_MS,
              id: LEASE_ID,
            },
          });
        }
      })
  );

  it.effect("reclaims an interrupted upload after its lease expires", () =>
    Effect.gen(function* () {
      const pendingUpload = yield* createPendingUpload();
      const { capabilityPath, t, uploadId } = pendingUpload;
      expect(yield* claimPendingUpload(pendingUpload)).toBe(true);
      vi.setSystemTime(NOW + FORUM_PENDING_UPLOAD_LEASE_MS);
      const response = yield* Effect.promise(() =>
        t.fetch(capabilityPath, {
          body: "hello",
          headers: { "content-type": "text/plain" },
          method: "POST",
        })
      );
      expect(response.status).toBe(200);
      expectPrivate(response);
      const upload = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.get("schoolClassForumPendingUploads", uploadId))
      );
      expect(upload).toMatchObject({ size: 5 });
      expect(upload).not.toHaveProperty("uploadLease");
    })
  );

  it.effect.each([
    { bodyFailure: "declared-size", status: 413 },
    { bodyFailure: "stream", status: 413 },
    { bodyFailure: "missing-content-type", status: 415 },
  ])(
    "rejects $bodyFailure without binding storage",
    ({ bodyFailure, status }) =>
      Effect.gen(function* () {
        const { capabilityPath, t, uploadId } = yield* createPendingUpload();
        const headers = new Headers();
        if (bodyFailure !== "missing-content-type") {
          headers.set("content-type", "text/plain");
        }
        if (bodyFailure === "declared-size") {
          headers.set("content-length", String(MAX_FORUM_ATTACHMENT_BYTES + 1));
        }
        const body =
          bodyFailure === "stream"
            ? new ReadableStream<Uint8Array>({
                start(controller) {
                  controller.error(new Error("Body read failed."));
                },
              })
            : new Uint8Array([1]);
        const request = {
          body,
          duplex: "half",
          headers,
          method: "POST",
        } satisfies RequestInit & { readonly duplex: "half" };
        const response = yield* Effect.promise(() =>
          t.fetch(capabilityPath, request)
        );
        expect(response.status).toBe(status);
        expectPrivate(response);
        expect(yield* Effect.promise(() => response.json())).toEqual({
          code: "FORUM_ATTACHMENT_UPLOAD_INVALID",
        });
        const upload = yield* Effect.promise(() =>
          t.query((ctx) =>
            ctx.db.get("schoolClassForumPendingUploads", uploadId)
          )
        );
        expect(upload).not.toHaveProperty("storageId");
        expect(upload).not.toHaveProperty("uploadLease");
      })
  );

  it.effect.each([
    "claim",
    "uuid",
    "store",
    "settle",
    "cleanup",
    "release",
    "deletion",
    "expiry",
  ])("preserves upload safety when %s interrupts the request", (failure) =>
    Effect.gen(function* () {
      const { capabilityPath, seeded, t, uploadId } =
        yield* createPendingUpload();
      const result = yield* Effect.promise(() =>
        t.action(async (ctx) => {
          const app: HonoWithConvex<ActionCtx> = new Hono();
          registerForumAttachmentUploadRoute(app);
          const originalMutation = ctx.runMutation;
          const runMutation: typeof ctx.runMutation = (reference, ...args) => {
            const name = getFunctionName(reference);
            const failedMutation = failure === "cleanup" ? "settle" : failure;
            if (
              name === `classes/forums/attachments/upload:${failedMutation}`
            ) {
              return Promise.reject(new Error("Private mutation failure."));
            }
            return originalMutation(reference, ...args);
          };
          vi.spyOn(ctx, "runMutation").mockImplementation(runMutation);
          const originalStore = ctx.storage.store;
          vi.spyOn(ctx.storage, "store").mockImplementation(async (blob) => {
            if (failure === "store" || failure === "release") {
              throw new Error("Private storage failure.");
            }
            const storageId = await originalStore(blob);
            if (failure === "deletion") {
              await t.mutation((mutation) =>
                mutation.db.patch("users", seeded.userId, {
                  deletionPreparedAt: NOW,
                })
              );
            } else if (failure === "expiry") {
              vi.setSystemTime(NOW + FORUM_PENDING_UPLOAD_EXPIRATION_MS);
            }
            return storageId;
          });
          const deleteStorage = vi.spyOn(ctx.storage, "delete");
          if (failure === "cleanup") {
            deleteStorage.mockRejectedValue(
              new Error("Private cleanup failure.")
            );
          }
          if (failure === "uuid") {
            vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
              throw new Error("Random source unavailable.");
            });
          }
          const response = await app.request(
            `https://example.convex.site${capabilityPath}`,
            {
              body: "hello",
              headers: { "content-type": "text/plain" },
              method: "POST",
            },
            ctx
          );
          expectPrivate(response);
          return {
            body: await response.json(),
            cleanupAttempts: deleteStorage.mock.calls.length,
            status: response.status,
          };
        })
      );
      const lostRace = failure === "deletion" || failure === "expiry";
      expect(result.status).toBe(lostRace ? 404 : 500);
      expect(result.body).toEqual({
        code: lostRace
          ? "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND"
          : "FORUM_ATTACHMENT_UPLOAD_FAILED",
      });
      if (failure === "settle" || failure === "cleanup") {
        expect(result.cleanupAttempts).toBe(1);
      }
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          pending: await ctx.db.get("schoolClassForumPendingUploads", uploadId),
          storage: await ctx.db.system.query("_storage").collect(),
        }))
      );
      expect(state.storage).toHaveLength(failure === "cleanup" ? 1 : 0);
      if (lostRace) {
        expect(state.pending).toBeNull();
      } else if (failure === "release") {
        expect(state.pending).toHaveProperty("uploadLease");
      } else {
        expect(state.pending).not.toHaveProperty("uploadLease");
      }
    })
  );
});
