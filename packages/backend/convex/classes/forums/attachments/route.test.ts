// @vitest-environment node

import { api, internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { MAX_FORUM_ATTACHMENT_BYTES } from "@repo/backend/convex/classes/forums/utils/constants";
import {
  insertClass,
  insertClassMembership,
  insertSchool,
  insertSchoolMembership,
} from "@repo/backend/convex/classes/test.helpers";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 15, 0, 0);
const polarSecretName = "POLAR_WEBHOOK_SECRET";
const uploadTokenSuffixPattern = /[^/]+$/;

/** Seeds one authenticated teacher and an open forum for HTTP upload tests. */
async function seedOpenForum(ctx: MutationCtx) {
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
}

/** Creates one pending upload through the same authenticated mutation as WWW. */
async function createPendingUpload() {
  const t = createConvexTestWithBetterAuth();
  const seeded = await t.mutation(seedOpenForum);
  const owner = t.withIdentity({
    sessionId: seeded.sessionId,
    subject: seeded.authUserId,
  });
  const upload = await owner.mutation(
    api.classes.forums.mutations.uploads.generateUploadUrl,
    { forumId: seeded.forumId }
  );
  const capability = new URL(upload.uploadUrl);
  const uploadToken = capability.pathname.split("/").at(-1);
  if (!uploadToken) {
    throw new Error("Expected a token in the upload capability path.");
  }

  return {
    capabilityPath: capability.pathname,
    owner,
    seeded,
    t,
    uploadId: upload.uploadId,
    uploadToken,
  };
}

/** Asserts response bytes and the capability URL remain private. */
function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
}

beforeEach(() => {
  process.env[polarSecretName] = "technical-webhook-secret";
});

afterEach(() => {
  delete process.env[polarSecretName];
});

describe("classes/forums/attachments/route", () => {
  it("stores, binds, and finalizes an attachment through the browser protocol", async () => {
    const { capabilityPath, owner, t, uploadId } = await createPendingUpload();
    const response = await t.fetch(capabilityPath, {
      body: "hello",
      headers: {
        "content-type": "text/plain",
        origin: "http://localhost:3000",
      },
      method: "POST",
    });

    expect(response.status).toBe(200);
    expectPrivate(response);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000"
    );
    const body = await Effect.runPromise(
      Schema.decodeUnknown(Schema.Struct({ storageId: Schema.String }))(
        await response.json()
      )
    );
    const boundUpload = await t.query((ctx) =>
      ctx.db.get("schoolClassForumPendingUploads", uploadId)
    );
    if (!boundUpload?.storageId) {
      throw new Error("Expected the HTTP action to bind its stored object.");
    }
    expect(body.storageId).toBe(boundUpload.storageId);

    await expect(
      owner.mutation(api.classes.forums.mutations.uploads.saveForumUpload, {
        name: "notes.txt",
        size: 5,
        storageId: boundUpload.storageId,
        type: "text/plain",
        uploadId,
      })
    ).resolves.toBe(uploadId);

    const state = await t.query(async (ctx) => {
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
    });

    expect(state.pendingUpload).toMatchObject({
      mimeType: "text/plain",
      name: "notes.txt",
      size: 5,
      storageId: body.storageId,
    });
    expect(state.storageMetadata).toMatchObject({ size: 5 });
  });

  it("rejects a wrong capability before consuming a hostile body", async () => {
    const { capabilityPath, t } = await createPendingUpload();
    const wrongPath = capabilityPath.replace(
      uploadTokenSuffixPattern,
      "wrong-token"
    );
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        /** Records any attempt to consume a body before capability rejection. */
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
    } satisfies RequestInit & { readonly duplex: "half" };

    const response = await t.fetch(wrongPath, request);

    expect(response.status).toBe(404);
    expectPrivate(response);
    expect(pulls).toBe(0);
    await expect(response.json()).resolves.toEqual({
      code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
    });
  });

  it("rejects an oversized upload without binding storage", async () => {
    const { capabilityPath, t, uploadId } = await createPendingUpload();
    const response = await t.fetch(capabilityPath, {
      body: "hello",
      headers: {
        "content-length": String(MAX_FORUM_ATTACHMENT_BYTES + 1),
        "content-type": "text/plain",
      },
      method: "POST",
    });

    expect(response.status).toBe(413);
    expectPrivate(response);
    await expect(response.json()).resolves.toEqual({
      code: "FORUM_ATTACHMENT_UPLOAD_INVALID",
    });
    await expect(
      t.query(async (ctx) => {
        const upload = await ctx.db.get(
          "schoolClassForumPendingUploads",
          uploadId
        );
        return upload?.storageId ?? null;
      })
    ).resolves.toBeNull();
  });

  it("binds a server-created object for an active upload capability", async () => {
    const { t, uploadId, uploadToken } = await createPendingUpload();
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["hello"], { type: "text/plain" }))
    );
    await expect(
      t.query((ctx) => ctx.db.system.get("_storage", storageId))
    ).resolves.toMatchObject({ size: 5 });

    await expect(
      t.mutation(internal.classes.forums.attachments.upload.settle, {
        contentType: "text/plain",
        size: 5,
        storageId,
        uploadId,
        uploadToken,
      })
    ).resolves.toBe("accepted");
  });

  it("removes a newly stored object when deletion wins the settlement race", async () => {
    const { seeded, t, uploadId, uploadToken } = await createPendingUpload();
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["hello"], { type: "text/plain" }))
    );

    await t.mutation((ctx) =>
      ctx.db.patch("users", seeded.userId, { deletionPreparedAt: NOW })
    );

    await expect(
      t.mutation(internal.classes.forums.attachments.upload.settle, {
        contentType: "text/plain",
        size: 5,
        storageId,
        uploadId,
        uploadToken,
      })
    ).resolves.toBe("discarded");

    await expect(
      t.query(async (ctx) => ({
        pendingUpload: await ctx.db.get(
          "schoolClassForumPendingUploads",
          uploadId
        ),
        storageMetadata: await ctx.db.system.get("_storage", storageId),
      }))
    ).resolves.toEqual({
      pendingUpload: null,
      storageMetadata: null,
    });
  });
});
