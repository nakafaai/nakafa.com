import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import { FORUM_PENDING_UPLOAD_LEASE_MS } from "@repo/backend/convex/classes/forums/attachments/constants";
import { createForumAttachmentUploadUrl } from "@repo/backend/convex/classes/forums/attachments/upload";
import {
  insertClass,
  insertSchool,
} from "@repo/backend/convex/classes/test.helpers";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { ConfigProvider, Effect } from "effect";

const NOW = Date.UTC(2026, 8, 13);
const TOKEN = "opaque-capability";
const LEASE = "owned-lease";
const mutations = internal.classes.forums.attachments.upload;

async function seedUpload() {
  const t = createConvexTestWithBetterAuth();
  const rows = await t.mutation(async (ctx) => {
    const { userId } = await seedAuthenticatedUser(ctx, {
      now: NOW,
      suffix: "upload-owner",
    });
    const schoolId = await insertSchool(ctx, { now: NOW, userId });
    const classId = await insertClass(ctx, { now: NOW, schoolId, userId });
    const forumId = await ctx.db.insert("schoolClassForums", {
      body: "Upload capability audit",
      classId,
      createdBy: userId,
      isPinned: false,
      lastPostAt: NOW,
      lastPostBy: userId,
      nextPostSequence: 1,
      postCount: 0,
      reactionCounts: [],
      schoolId,
      status: "open",
      tag: "general",
      title: "Attachments",
      updatedAt: NOW,
    });
    const uploadId = await ctx.db.insert("schoolClassForumPendingUploads", {
      classId,
      forumId,
      expiresAt: NOW + FORUM_PENDING_UPLOAD_LEASE_MS * 2,
      uploadedBy: userId,
      uploadToken: TOKEN,
    });
    return { uploadId, userId };
  });
  return { ...rows, t };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("forum upload capability", () => {
  it.effect(
    "requires a valid deployment URL and keeps the opaque capability intact",
    () =>
      Effect.gen(function* () {
        const { uploadId } = yield* Effect.promise(seedUpload);
        const program = createForumAttachmentUploadUrl(uploadId, TOKEN);
        const url = yield* program.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord({
              CONVEX_SITE_URL: "https://local.convex.site",
            })
          )
        );
        expect(new URL(url).origin).toBe("https://local.convex.site");
        expect(new URL(url).pathname).toBe(
          `/internal/forum-attachments/upload/${uploadId}/${TOKEN}`
        );
        const failure = yield* program.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord({ CONVEX_SITE_URL: "not a URL" })
          ),
          Effect.flip
        );
        expect(failure).toMatchObject({
          _tag: "ForumAttachmentUploadConfigError",
          code: "FORUM_ATTACHMENT_UPLOAD_CONFIG_INVALID",
        });
      })
  );

  it("leases once, preserves unrelated leases, and releases only its owner", async () => {
    const { t, uploadId } = await seedUpload();
    const claim = { leaseId: LEASE, uploadId, uploadToken: TOKEN };
    expect(await t.mutation(mutations.claim, claim)).toBe(true);
    expect(await t.mutation(mutations.claim, claim)).toBe(false);
    await t.mutation(mutations.release, { uploadId, leaseId: "another-lease" });
    const leased = await t.query((ctx) =>
      ctx.db.get("schoolClassForumPendingUploads", uploadId)
    );
    expect(leased?.uploadLease).toEqual({
      id: LEASE,
      expiresAt: NOW + FORUM_PENDING_UPLOAD_LEASE_MS,
    });
    await t.mutation(mutations.release, { uploadId, leaseId: LEASE });
    const released = await t.query((ctx) =>
      ctx.db.get("schoolClassForumPendingUploads", uploadId)
    );
    expect(released?.uploadLease).toBeUndefined();
    expect(await t.mutation(mutations.claim, claim)).toBe(true);
    await expect(
      t.mutation(mutations.release, { uploadId: "invalid", leaseId: LEASE })
    ).resolves.toBeNull();
    await t.mutation((ctx) =>
      ctx.db.delete("schoolClassForumPendingUploads", uploadId)
    );
    await expect(
      t.mutation(mutations.release, { uploadId, leaseId: LEASE })
    ).resolves.toBeNull();
  });

  it.each([
    "invalid",
    "missing",
    "wrong-token",
    "expired",
    "missing-owner",
    "deleting-owner",
  ])("rejects a %s capability before granting a lease", async (state) => {
    const { t, uploadId, userId } = await seedUpload();
    await t.mutation(async (ctx) => {
      if (state === "missing") {
        await ctx.db.delete("schoolClassForumPendingUploads", uploadId);
      }
      if (state === "expired") {
        await ctx.db.patch("schoolClassForumPendingUploads", uploadId, {
          expiresAt: NOW,
        });
      }
      if (state === "missing-owner") {
        await ctx.db.delete("users", userId);
      }
      if (state === "deleting-owner") {
        await ctx.db.patch("users", userId, { deletionPreparedAt: NOW });
      }
    });
    expect(
      await t.mutation(mutations.claim, {
        uploadId: state === "invalid" ? "invalid" : uploadId,
        uploadToken: state === "wrong-token" ? "wrong" : TOKEN,
        leaseId: LEASE,
      })
    ).toBe(false);
  });

  it.each([
    "invalid",
    "missing",
    "wrong-token",
    "bound",
    "expired",
    "unleased",
    "wrong-lease",
    "expired-lease",
    "missing-owner",
    "deleting-owner",
    "accepted",
  ])("settles a %s upload without leaking a storage object", async (state) => {
    const { t, uploadId, userId } = await seedUpload();
    expect(
      await t.mutation(mutations.claim, {
        uploadId,
        uploadToken: TOKEN,
        leaseId: LEASE,
      })
    ).toBe(true);
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["notes"], { type: "text/plain" }))
    );
    const previousStorageId =
      state === "bound"
        ? await t.run((ctx) => ctx.storage.store(new Blob(["original"])))
        : undefined;
    await t.mutation(async (ctx) => {
      if (state === "missing") {
        await ctx.db.delete("schoolClassForumPendingUploads", uploadId);
      }
      if (previousStorageId) {
        await ctx.db.patch("schoolClassForumPendingUploads", uploadId, {
          storageId: previousStorageId,
        });
      }
      if (state === "expired") {
        await ctx.db.patch("schoolClassForumPendingUploads", uploadId, {
          expiresAt: NOW,
        });
      }
      if (state === "unleased") {
        await ctx.db.patch("schoolClassForumPendingUploads", uploadId, {
          uploadLease: undefined,
        });
      }
      if (state === "expired-lease") {
        await ctx.db.patch("schoolClassForumPendingUploads", uploadId, {
          uploadLease: { id: LEASE, expiresAt: NOW },
        });
      }
      if (state === "missing-owner") {
        await ctx.db.delete("users", userId);
      }
      if (state === "deleting-owner") {
        await ctx.db.patch("users", userId, { deletionPreparedAt: NOW });
      }
    });
    const outcome = await t.mutation(mutations.settle, {
      contentType: "text/plain",
      size: 5,
      storageId,
      uploadId: state === "invalid" ? "invalid" : uploadId,
      uploadToken: state === "wrong-token" ? "wrong" : TOKEN,
      leaseId: state === "wrong-lease" ? "another-lease" : LEASE,
    });
    const discarded = state === "missing-owner" || state === "deleting-owner";
    const saved = await t.query(async (ctx) => ({
      metadata: await ctx.db.system.get("_storage", storageId),
      upload: await ctx.db.get("schoolClassForumPendingUploads", uploadId),
    }));
    if (state === "accepted") {
      expect(outcome).toBe("accepted");
      expect(saved.metadata).toMatchObject({ size: 5 });
      expect(saved.upload).toMatchObject({
        storageId,
        mimeType: "text/plain",
        size: 5,
      });
      expect(saved.upload?.uploadLease).toBeUndefined();
      expect(
        await t.mutation(mutations.claim, {
          uploadId,
          uploadToken: TOKEN,
          leaseId: LEASE,
        })
      ).toBe(false);
    } else {
      expect(outcome).toBe(discarded ? "discarded" : "rejected");
      expect(saved.metadata).toBeNull();
      if (previousStorageId) {
        expect(
          await t.query((ctx) =>
            ctx.db.system.get("_storage", previousStorageId)
          )
        ).toMatchObject({ size: 8 });
        expect(saved.upload?.storageId).toBe(previousStorageId);
      }
      if (discarded || state === "expired" || state === "missing") {
        expect(saved.upload).toBeNull();
      }
    }
  });
});
