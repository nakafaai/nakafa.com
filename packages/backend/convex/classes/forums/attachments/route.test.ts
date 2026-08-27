// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { api, internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  FORUM_PENDING_UPLOAD_EXPIRATION_MS,
  FORUM_PENDING_UPLOAD_LEASE_MS,
} from "@repo/backend/convex/classes/forums/attachments/constants";
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
import { Effect, Schema } from "effect";
import { vi } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 15, 0, 0);
const LEASE_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const polarSecretName = "POLAR_WEBHOOK_SECRET";
const uploadTokenSuffixPattern = /[^/]+$/;

/** Seeds one authenticated teacher and an open forum for HTTP upload tests. */
const seedOpenForum = Effect.fn("test.forumAttachments.seedOpenForum")(
  (ctx: MutationCtx) =>
    Effect.promise(async () => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "forum-upload-route",
      });
      const schoolId = await insertSchool(ctx, {
        now: NOW,
        userId: user.userId,
      });
      const classId = await insertClass(ctx, {
        now: NOW,
        schoolId,
        userId: user.userId,
      });
      await insertSchoolMembership(ctx, {
        now: NOW,
        role: "teacher",
        schoolId,
        userId: user.userId,
      });
      await insertClassMembership(ctx, {
        now: NOW,
        role: "teacher",
        classId,
        schoolId,
        userId: user.userId,
      });
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
  vi.stubEnv(polarSecretName, "technical-webhook-secret");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("classes/forums/attachments/route", () => {
  it.effect(
    "stores, binds, and finalizes an attachment through the browser protocol",
    () =>
      Effect.gen(function* () {
        const { capabilityPath, owner, t, uploadId } =
          yield* createPendingUpload();
        const response = yield* Effect.promise(() =>
          t.fetch(capabilityPath, {
            body: "hello",
            headers: {
              "content-type": "text/plain",
              origin: "http://localhost:3000",
            },
            method: "POST",
          })
        );
        expect(response.status).toBe(200);
        expectPrivate(response);
        expect(response.headers.get("access-control-allow-origin")).toBe(
          "http://localhost:3000"
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
            size: 5,
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
          size: 5,
          storageId: body.storageId,
        });
        expect(state.storageMetadata).toMatchObject({ size: 5 });
      })
  );
  it.effect("rejects a wrong capability before consuming a hostile body", () =>
    Effect.gen(function* () {
      const { capabilityPath, t } = yield* createPendingUpload();
      const wrongPath = capabilityPath.replace(
        uploadTokenSuffixPattern,
        "wrong-token"
      );
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
      const request = {
        body,
        duplex: "half",
        headers: { "content-type": "text/plain" },
        method: "POST",
      } satisfies RequestInit & {
        readonly duplex: "half";
      };
      const response = yield* Effect.promise(() => t.fetch(wrongPath, request));
      expect(response.status).toBe(404);
      expectPrivate(response);
      expect(pulls).toBe(0);
      expect(yield* Effect.promise(() => response.json())).toEqual({
        code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
      });
    })
  );

  it.effect(
    "rejects a concurrent request before consuming its hostile body",
    () =>
      Effect.gen(function* () {
        const pendingUpload = yield* createPendingUpload();
        const { capabilityPath, t, uploadId } = pendingUpload;
        expect(yield* claimPendingUpload(pendingUpload)).toBe(true);
        let pulls = 0;
        const body = new ReadableStream<Uint8Array>(
          {
            pull(controller) {
              pulls += 1;
              controller.error(
                new Error("Leased capability body was consumed.")
              );
            },
          },
          { highWaterMark: 0 }
        );
        const request = {
          body,
          duplex: "half",
          headers: { "content-type": "text/plain" },
          method: "POST",
        } satisfies RequestInit & {
          readonly duplex: "half";
        };
        const response = yield* Effect.promise(() =>
          t.fetch(capabilityPath, request)
        );
        expect(response.status).toBe(404);
        expectPrivate(response);
        expect(pulls).toBe(0);
        const upload = yield* Effect.promise(() =>
          t.query((ctx) =>
            ctx.db.get("schoolClassForumPendingUploads", uploadId)
          )
        );
        expect(upload).toMatchObject({
          uploadLease: {
            expiresAt: NOW + FORUM_PENDING_UPLOAD_LEASE_MS,
            id: LEASE_ID,
          },
        });
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

  it.effect(
    "rejects an expired capability before consuming the request body",
    () =>
      Effect.gen(function* () {
        const { capabilityPath, t, uploadId } = yield* createPendingUpload();
        vi.setSystemTime(NOW + FORUM_PENDING_UPLOAD_EXPIRATION_MS);
        let pulls = 0;
        const body = new ReadableStream<Uint8Array>(
          {
            pull(controller) {
              pulls += 1;
              controller.error(
                new Error("Expired capability body was consumed.")
              );
            },
          },
          { highWaterMark: 0 }
        );
        const request = {
          body,
          duplex: "half",
          headers: { "content-type": "text/plain" },
          method: "POST",
        } satisfies RequestInit & {
          readonly duplex: "half";
        };
        const response = yield* Effect.promise(() =>
          t.fetch(capabilityPath, request)
        );
        expect(response.status).toBe(404);
        expectPrivate(response);
        expect(pulls).toBe(0);
        expect(yield* Effect.promise(() => response.json())).toEqual({
          code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
        });
        expect(
          yield* Effect.promise(() =>
            t.query((ctx) =>
              ctx.db.get("schoolClassForumPendingUploads", uploadId)
            )
          )
        ).not.toBeNull();
      })
  );

  it.effect("rejects an oversized upload without binding storage", () =>
    Effect.gen(function* () {
      const { capabilityPath, t, uploadId } = yield* createPendingUpload();
      const response = yield* Effect.promise(() =>
        t.fetch(capabilityPath, {
          body: "hello",
          headers: {
            "content-length": String(MAX_FORUM_ATTACHMENT_BYTES + 1),
            "content-type": "text/plain",
          },
          method: "POST",
        })
      );
      expect(response.status).toBe(413);
      expectPrivate(response);
      expect(yield* Effect.promise(() => response.json())).toEqual({
        code: "FORUM_ATTACHMENT_UPLOAD_INVALID",
      });
      const upload = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.get("schoolClassForumPendingUploads", uploadId))
      );
      expect({
        storageId: upload?.storageId ?? null,
        uploadLease: upload?.uploadLease,
      }).toEqual({
        storageId: null,
        uploadLease: undefined,
      });
    })
  );

  it.effect(
    "binds a server-created object for an active upload capability",
    () =>
      Effect.gen(function* () {
        const pendingUpload = yield* createPendingUpload();
        const { t, uploadId, uploadToken } = pendingUpload;
        expect(yield* claimPendingUpload(pendingUpload)).toBe(true);
        const storageId = yield* Effect.promise(() =>
          t.run((ctx) =>
            ctx.storage.store(new Blob(["hello"], { type: "text/plain" }))
          )
        );
        const storageMetadata = yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.system.get("_storage", storageId))
        );
        expect(storageMetadata).toMatchObject({ size: 5 });
        const settlement = yield* Effect.promise(() =>
          t.mutation(internal.classes.forums.attachments.upload.settle, {
            contentType: "text/plain",
            leaseId: LEASE_ID,
            size: 5,
            storageId,
            uploadId,
            uploadToken,
          })
        );
        expect(settlement).toBe("accepted");
      })
  );

  it.effect(
    "removes a newly stored object when deletion wins the settlement race",
    () =>
      Effect.gen(function* () {
        const pendingUpload = yield* createPendingUpload();
        const { seeded, t, uploadId, uploadToken } = pendingUpload;
        expect(yield* claimPendingUpload(pendingUpload)).toBe(true);
        const storageId = yield* Effect.promise(() =>
          t.run((ctx) =>
            ctx.storage.store(new Blob(["hello"], { type: "text/plain" }))
          )
        );
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch("users", seeded.userId, { deletionPreparedAt: NOW })
          )
        );
        const settlement = yield* Effect.promise(() =>
          t.mutation(internal.classes.forums.attachments.upload.settle, {
            contentType: "text/plain",
            leaseId: LEASE_ID,
            size: 5,
            storageId,
            uploadId,
            uploadToken,
          })
        );
        expect(settlement).toBe("discarded");
        const state = yield* Effect.promise(() =>
          t.query(async (ctx) => ({
            pendingUpload: await ctx.db.get(
              "schoolClassForumPendingUploads",
              uploadId
            ),
            storageMetadata: await ctx.db.system.get("_storage", storageId),
          }))
        );
        expect(state).toEqual({
          pendingUpload: null,
          storageMetadata: null,
        });
      })
  );

  it.effect(
    "removes a server-created object when settlement reaches its deadline",
    () =>
      Effect.gen(function* () {
        const pendingUpload = yield* createPendingUpload();
        const { t, uploadId, uploadToken } = pendingUpload;
        expect(yield* claimPendingUpload(pendingUpload)).toBe(true);
        const storageId = yield* Effect.promise(() =>
          t.run((ctx) =>
            ctx.storage.store(new Blob(["hello"], { type: "text/plain" }))
          )
        );
        vi.setSystemTime(NOW + FORUM_PENDING_UPLOAD_EXPIRATION_MS);
        const settlement = yield* Effect.promise(() =>
          t.mutation(internal.classes.forums.attachments.upload.settle, {
            contentType: "text/plain",
            leaseId: LEASE_ID,
            size: 5,
            storageId,
            uploadId,
            uploadToken,
          })
        );
        expect(settlement).toBe("rejected");
        const state = yield* Effect.promise(() =>
          t.query(async (ctx) => ({
            pendingUpload: await ctx.db.get(
              "schoolClassForumPendingUploads",
              uploadId
            ),
            storageMetadata: await ctx.db.system.get("_storage", storageId),
          }))
        );
        expect(state).toEqual({
          pendingUpload: null,
          storageMetadata: null,
        });
      })
  );
});
