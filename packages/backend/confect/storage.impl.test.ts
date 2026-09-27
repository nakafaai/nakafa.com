import { Ref } from "@confect/core";
import {
  DatabaseReader as NativeDatabaseReader,
  Scheduler,
} from "@confect/server";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { StorageWriter } from "@repo/backend/confect/_generated/services";
import {
  insertClass,
  insertSchool,
} from "@repo/backend/confect/classes/test.helpers";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { sweepStorage } from "@repo/backend/confect/storage.impl";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 8, 27);
const DAY = 24 * 60 * 60 * 1000;
const sweep = Ref.getFunctionReference(refs.internal.storage.sweep);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("storage orphan recovery", () => {
  it("keeps referenced uploads, attachments, and recent files while deleting an old orphan", async () => {
    const t = createConvexTestWithBetterAuth();
    const uploadBlob = await t.run((ctx) =>
      ctx.storage.store(new Blob(["pending"]))
    );
    const attachmentBlob = await t.run((ctx) =>
      ctx.storage.store(new Blob(["attachment"]))
    );
    const orphan = await t.run((ctx) =>
      ctx.storage.store(new Blob(["interrupted"]))
    );
    await t.mutation(async (ctx) => {
      const { userId } = await seedAuthenticatedUser(ctx, { now: NOW });
      const schoolId = await insertSchool(ctx, { now: NOW, userId });
      const classId = await insertClass(ctx, { now: NOW, schoolId, userId });
      const forumId = await ctx.db.insert("schoolClassForums", {
        body: "Storage ownership",
        classId,
        createdBy: userId,
        isPinned: false,
        lastPostAt: NOW,
        lastPostBy: userId,
        nextPostSequence: 2,
        postCount: 1,
        reactionCounts: [],
        schoolId,
        status: "open",
        tag: "general",
        title: "Storage",
        updatedAt: NOW,
      });
      const postId = await ctx.db.insert("schoolClassForumPosts", {
        body: "Attached post",
        classId,
        createdBy: userId,
        forumId,
        mentions: [],
        reactionCounts: [],
        replyCount: 0,
        sequence: 1,
        updatedAt: NOW,
      });
      await ctx.db.insert("schoolClassForumPostAttachments", {
        classId,
        createdBy: userId,
        fileId: attachmentBlob,
        forumId,
        mimeType: "text/plain",
        name: "attachment.txt",
        postId,
        size: 10,
      });
      await ctx.db.insert("schoolClassForumPendingUploads", {
        classId,
        expiresAt: NOW,
        forumId,
        storageId: uploadBlob,
        uploadedBy: userId,
        uploadToken: "pending",
      });
    });
    vi.setSystemTime(NOW + 1);
    const boundary = await t.run((ctx) =>
      ctx.storage.store(new Blob(["exactly 24 hours old"]))
    );
    vi.setSystemTime(NOW + DAY + 1);
    const recent = await t.run((ctx) =>
      ctx.storage.store(new Blob(["recent"]))
    );
    expect(await t.mutation(sweep, {})).toEqual({
      deleted: 1,
      done: true,
      scanned: 3,
    });
    expect(await t.run((ctx) => ctx.storage.get(orphan))).toBeNull();
    const retained = await t.query((ctx) =>
      ctx.db.system.query("_storage").collect()
    );
    expect(retained.map(({ _id }) => _id)).toEqual([
      uploadBlob,
      attachmentBlob,
      boundary,
      recent,
    ]);
  });

  it("continues bounded pages with the original age cutoff even if recovery runs late", async () => {
    const t = createConvexTestWithBetterAuth();
    for (let index = 0; index < 18; index += 1) {
      await t.run((ctx) => ctx.storage.store(new Blob([`${index}`])));
    }
    vi.setSystemTime(NOW + DAY + 1);
    const recent = await t.run((ctx) =>
      ctx.storage.store(new Blob(["uploaded after the sweep cutoff"]))
    );
    expect(await t.mutation(sweep, {})).toEqual({
      deleted: 16,
      done: false,
      scanned: 16,
    });
    const scheduled = await t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(scheduled).toEqual([
      expect.objectContaining({
        args: [
          { continuation: { before: NOW + 1, cursor: expect.any(String) } },
        ],
        name: "storage:sweep",
      }),
    ]);
    vi.setSystemTime(NOW + 3 * DAY);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      await t.query((ctx) => ctx.db.system.query("_storage").collect())
    ).toEqual([expect.objectContaining({ _id: recent })]);
  });

  it("continues after a failed storage deletion and retries that file on the next sweep", async () => {
    const t = createConvexTestWithBetterAuth();
    const failed = await t.run((ctx) =>
      ctx.storage.store(new Blob(["retry this file"]))
    );
    const removed = await t.run((ctx) =>
      ctx.storage.store(new Blob(["remove this file"]))
    );
    vi.setSystemTime(NOW + DAY + 1);
    const result = await t.mutation((ctx) => {
      vi.spyOn(ctx.storage, "delete").mockRejectedValueOnce(
        new Error("Storage temporarily unavailable")
      );
      return runConvexProgram(
        sweepStorage({}).pipe(
          Effect.provide([
            NativeDatabaseReader.layer(databaseSchema, ctx.db),
            Scheduler.layer(ctx.scheduler),
            StorageWriter.layer(ctx.storage),
          ])
        )
      );
    });
    expect(result).toEqual({ deleted: 1, done: true, scanned: 2 });
    expect(await t.run((ctx) => ctx.storage.get(removed))).toBeNull();
    expect(
      await t.run(async (ctx) => (await ctx.storage.get(failed))?.text())
    ).toBe("retry this file");
    expect(await t.mutation(sweep, {})).toEqual({
      deleted: 1,
      done: true,
      scanned: 1,
    });
    expect(await t.mutation(sweep, {})).toEqual({
      deleted: 0,
      done: true,
      scanned: 0,
    });
  });
});
