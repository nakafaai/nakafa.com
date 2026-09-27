// @vitest-environment node
import { GenericId } from "@confect/core";
import { afterEach, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import { createClassFixture } from "@repo/backend/test/classes";
import { Schema } from "effect";

afterEach(() => vi.unstubAllEnvs());

it("finalizes valid names idempotently and protects upload ownership", async () => {
  vi.stubEnv("POLAR_WEBHOOK_SECRET", "technical-webhook-secret");
  const { t, admin, outsider, classId } = await createClassFixture();
  const forumId = await admin.mutation(
    api.classes.forums.mutations.forums.createForum,
    {
      classId,
      title: "Attachment ownership",
      body: "Share notes",
      tag: "general",
    }
  );
  const uploads = api.classes.forums.mutations.uploads;
  const upload = await admin.mutation(uploads.generateUploadUrl, { forumId });
  const response = await t.fetch(new URL(upload.uploadUrl).pathname, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "hello",
  });
  expect(response.status).toBe(200);
  const { storageId } = Schema.decodeUnknownSync(
    Schema.Struct({
      storageId: GenericId.GenericId("_storage"),
    })
  )(await response.json());
  const save = {
    uploadId: upload.uploadId,
    storageId,
    name: "notes.txt",
    size: 5,
    type: "text/plain",
  };
  for (const name of ["", " \t "]) {
    await expect(
      admin.mutation(uploads.saveForumUpload, { ...save, name })
    ).rejects.toMatchObject({
      data: { code: "FORUM_ATTACHMENT_NAME_INVALID" },
    });
    expect(
      await t.query((ctx) =>
        ctx.db.get("schoolClassForumPendingUploads", upload.uploadId)
      )
    ).not.toHaveProperty("name");
  }
  await expect(
    outsider.mutation(uploads.saveForumUpload, save)
  ).rejects.toMatchObject({
    data: { code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND" },
  });
  expect(await admin.mutation(uploads.saveForumUpload, save)).toBe(
    upload.uploadId
  );
  const bound = await t.query((ctx) =>
    ctx.db.get("schoolClassForumPendingUploads", upload.uploadId)
  );
  expect(await admin.mutation(uploads.saveForumUpload, save)).toBe(
    upload.uploadId
  );
  expect(
    await t.query((ctx) =>
      ctx.db.get("schoolClassForumPendingUploads", upload.uploadId)
    )
  ).toEqual(bound);
  const secondStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["other"], { type: "text/plain" }))
  );
  await expect(
    admin.mutation(uploads.saveForumUpload, {
      ...save,
      storageId: secondStorageId,
    })
  ).rejects.toMatchObject({
    data: { code: "FORUM_ATTACHMENT_UPLOAD_ALREADY_SAVED" },
  });
  await outsider.mutation(uploads.discardForumUploads, {
    uploadIds: [upload.uploadId],
  });
  expect(
    await t.query((ctx) =>
      ctx.db.get("schoolClassForumPendingUploads", upload.uploadId)
    )
  ).toEqual(bound);
  expect(
    await t.query((ctx) => ctx.db.system.get("_storage", storageId))
  ).not.toBeNull();
  for (const size of [6, Number.NaN]) {
    await t.mutation((ctx) => ctx.db.patch(upload.uploadId, { size }));
    await expect(
      admin.mutation(api.classes.forums.mutations.posts.createForumPost, {
        attachmentUploadIds: [upload.uploadId],
        body: "Changed attachment",
        forumId,
      })
    ).rejects.toMatchObject({
      data: {
        code: Number.isNaN(size)
          ? "FORUM_ATTACHMENT_IO_FAILED"
          : "FORUM_ATTACHMENT_METADATA_MISMATCH",
      },
    });
    expect(
      await t.query((ctx) => ctx.db.query("schoolClassForumPosts").collect())
    ).toEqual([]);
  }
  await t.mutation((ctx) => ctx.db.patch(upload.uploadId, { size: 5 }));
  await t.run((ctx) => ctx.storage.delete(storageId));
  await admin.mutation(uploads.discardForumUploads, {
    uploadIds: [upload.uploadId, upload.uploadId],
  });
  expect(
    await t.query((ctx) =>
      ctx.db.get("schoolClassForumPendingUploads", upload.uploadId)
    )
  ).toBeNull();
  expect(
    await t.query((ctx) => ctx.db.system.get("_storage", storageId))
  ).toBeNull();
  await expect(
    admin.mutation(uploads.saveForumUpload, save)
  ).rejects.toMatchObject({
    data: { code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND" },
  });
  await expect(
    admin.mutation(api.classes.forums.mutations.posts.createForumPost, {
      attachmentUploadIds: [upload.uploadId],
      body: "Discarded attachment",
      forumId,
    })
  ).rejects.toMatchObject({
    data: { code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND" },
  });
  expect(
    await t.query((ctx) => ctx.db.system.get("_storage", secondStorageId))
  ).not.toBeNull();
});
