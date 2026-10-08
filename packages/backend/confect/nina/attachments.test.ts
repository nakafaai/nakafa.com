import { RegisteredConvexFunction } from "@confect/server";
import { storeFile } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  consumeAttachments,
  requireStoredDocumentLimit,
} from "@repo/backend/confect/nina/attachments";
import { NINA_DOCUMENT_SIZE } from "@repo/backend/confect/nina/uploads.spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { Array as Arr, Effect, Schema } from "effect";

const MiB = 1024 * 1024;
/** One tenth of a MiB, rounded up to a whole byte. */
const TENTH_MIB = Math.ceil(MiB / 10);
const NOW = Date.UTC(2026, 8, 27, 12);
/** Far enough ahead that no grant in these tests expires. */
const EXPIRES_AT = Date.UTC(2100, 0, 1);

const StoredFile = Schema.Struct({
  mediaType: Schema.String,
  size: Schema.Finite,
});
type StoredFile = typeof StoredFile.Type;
type TestTransaction = ReturnType<typeof createConvexTestWithBetterAuth>;
type UploadId = Docs["ninaUploads"]["_id"];

/**
 * Stores each file in the Agent component from an action, as production does,
 * then grants it to one user as a ready upload.
 */
async function seedUploads(t: TestTransaction, files: readonly StoredFile[]) {
  let fileIds: readonly string[] = [];
  for (const [index, file] of files.entries()) {
    const fileId = await t.action(
      async (ctx) =>
        (
          await storeFile(
            ctx,
            components.nina,
            new Blob([new Uint8Array(file.size)], { type: file.mediaType }),
            { filename: `attachment-${index}` }
          )
        ).file.fileId
    );
    fileIds = Arr.append(fileIds, fileId);
  }
  return await t.run(async (ctx) => {
    const { userId } = await seedAuthenticatedUser(ctx, { now: NOW });
    const uploadIds = await Promise.all(
      Arr.map(fileIds, (fileId) =>
        ctx.db.insert("ninaUploads", {
          userId,
          expiresAt: EXPIRES_AT,
          state: { status: "ready", fileId },
        })
      )
    );
    return { userId, uploadIds };
  });
}

/** Reports, for each upload, whether its grant still exists. */
function grantsKept(t: TestTransaction, uploadIds: UploadId[]) {
  return t.run((ctx) =>
    Promise.all(
      Arr.map(
        uploadIds,
        async (uploadId) => (await ctx.db.get("ninaUploads", uploadId)) !== null
      )
    )
  );
}

/** Reads the stored file of each upload, as a stored message names its files. */
function storedFileIds(t: TestTransaction, uploadIds: UploadId[]) {
  return t.run(async (ctx) => {
    const uploads = await Promise.all(
      Arr.map(uploadIds, (uploadId) => ctx.db.get("ninaUploads", uploadId))
    );
    return Arr.flatMap(uploads, (upload) =>
      upload?.state.status === "ready" ? [upload.state.fileId] : []
    );
  });
}

/** Applies the limit to stored files and reports the refusal, if any. */
function checkStored(t: TestTransaction, fileIds: readonly string[]) {
  return t.run((ctx) =>
    Effect.runPromise(
      requireStoredDocumentLimit(fileIds).pipe(
        Effect.match({
          onFailure: (error) => error.code,
          onSuccess: () => "accepted" as const,
        }),
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

describe("Nina attachment document limit", () => {
  it("accepts documents that total exactly the limit and consumes every grant", async () => {
    const t = createConvexTestWithBetterAuth();
    const { userId, uploadIds } = await seedUploads(t, [
      { mediaType: "application/pdf", size: NINA_DOCUMENT_SIZE - 2 * MiB },
      { mediaType: "text/plain", size: 2 * MiB },
    ]);

    const fileIds = await t.run((ctx) =>
      Effect.runPromise(
        consumeAttachments(userId, uploadIds).pipe(
          Effect.map((consumed) => consumed.fileIds),
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      )
    );

    expect(fileIds).toHaveLength(2);
    expect(await grantsKept(t, uploadIds)).toEqual([false, false]);
  });

  it("rejects documents that total 10.1 MiB and keeps every grant", async () => {
    const t = createConvexTestWithBetterAuth();
    const { userId, uploadIds } = await seedUploads(t, [
      { mediaType: "application/pdf", size: NINA_DOCUMENT_SIZE - 2 * MiB },
      { mediaType: "text/plain", size: 2 * MiB + TENTH_MIB },
    ]);

    const failure = await t.run((ctx) =>
      Effect.runPromise(
        consumeAttachments(userId, uploadIds).pipe(
          Effect.flip,
          Effect.map((error) => ({ tag: error._tag, code: error.code })),
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      )
    );

    expect(failure).toEqual({
      tag: "NinaUploadError",
      code: "NINA_UPLOAD_SIZE",
    });
    // Confect throws this failure as a ConvexError, which aborts the send
    // transaction and rolls back the credits reserved before it. The check
    // runs before any grant is deleted, so every upload stays usable.
    expect(await grantsKept(t, uploadIds)).toEqual([true, true]);
  });

  it("ignores images of any size when the documents fit", async () => {
    const t = createConvexTestWithBetterAuth();
    const { userId, uploadIds } = await seedUploads(t, [
      { mediaType: "image/png", size: 12 * MiB },
      { mediaType: "application/pdf", size: MiB },
    ]);

    const partTypes = await t.run((ctx) =>
      Effect.runPromise(
        consumeAttachments(userId, uploadIds).pipe(
          Effect.map((consumed) =>
            Arr.map(consumed.parts, (part) => part.type)
          ),
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      )
    );

    expect(partTypes).toEqual(["image", "file"]);
    expect(await grantsKept(t, uploadIds)).toEqual([false, false]);
  });
  it("refuses a stored message whose documents total 10.1 MiB before a retry sends it", async () => {
    const t = createConvexTestWithBetterAuth();
    const { uploadIds } = await seedUploads(t, [
      { mediaType: "application/pdf", size: NINA_DOCUMENT_SIZE - 2 * MiB },
      { mediaType: "text/plain", size: 2 * MiB + TENTH_MIB },
    ]);

    expect(await checkStored(t, await storedFileIds(t, uploadIds))).toBe(
      "NINA_UPLOAD_SIZE"
    );
  });

  it("accepts a stored message whose documents fit, whatever its images weigh", async () => {
    const t = createConvexTestWithBetterAuth();
    const { uploadIds } = await seedUploads(t, [
      { mediaType: "image/png", size: 12 * MiB },
      { mediaType: "application/pdf", size: NINA_DOCUMENT_SIZE },
    ]);

    expect(await checkStored(t, await storedFileIds(t, uploadIds))).toBe(
      "accepted"
    );
  });
});
