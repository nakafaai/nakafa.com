import { RegisteredConvexFunction } from "@confect/server";
import { storeFile } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { NINA_DOCUMENT_SIZE } from "@repo/backend/client/nina/uploads";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  consumeAttachments,
  requireStoredDocumentLimit,
} from "@repo/backend/confect/nina/attachments";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import {
  learnerWithKeyIn,
  sealedFileNameIn,
} from "@repo/backend/test/nina/sealed";
import { Array as Arr, Effect, Schema } from "effect";

vi.mock("@repo/backend/confect/vault/keys", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@repo/backend/confect/vault/keys")>();
  return { ...actual, readLearnerKeys: vi.fn(actual.readLearnerKeys) };
});

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
type UploadOwner = Docs["users"]["_id"];

/**
 * Stores each file in the Agent component from an action, as production does,
 * then grants it to one user as a ready upload.
 */
async function seedUploads(t: TestTransaction, files: readonly StoredFile[]) {
  let fileIds: readonly string[] = [];
  const rows = Arr.map(files, (file, index) => ({ file, index }));
  for (const { file, index } of rows) {
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

/** Applies the limit to the stored files and reports the refusal, if any. */
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
        consumeAttachments(userId, uploadIds, "Read these.").pipe(
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
        consumeAttachments(userId, uploadIds, "Read these.").pipe(
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
        consumeAttachments(userId, uploadIds, "Read these.").pipe(
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

  it("refuses a message that costs more than one turn carries, and keeps every grant", async () => {
    const t = createConvexTestWithBetterAuth();
    const { userId, uploadIds } = await seedUploads(t, [
      { mediaType: "application/pdf", size: MiB },
    ]);

    // Eighty thousand letters cost more than a turn carries at any letter rate
    // the profile could hold, so the refusal does not depend on the profile.
    const failure = await t.run((ctx) =>
      Effect.runPromise(
        consumeAttachments(userId, uploadIds, "a".repeat(80_000)).pipe(
          Effect.flip,
          Effect.map((error) => ({ tag: error._tag, code: error.code })),
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      )
    );

    expect(failure).toEqual({
      tag: "NinaTurnError",
      code: "NINA_MESSAGE_SIZE",
    });
    expect(await grantsKept(t, uploadIds)).toEqual([true]);
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

/** Stores one file under `filename` from an action, as an upload does, and returns its id. */
function storeNamedFile(t: TestTransaction, filename: string) {
  return t.action(
    async (ctx) =>
      (
        await storeFile(
          ctx,
          components.nina,
          new Blob(["Soal"], { type: "application/pdf" }),
          { filename }
        )
      ).file.fileId
  );
}

/**
 * Grants `userId` a ready upload of `fileId`. `nameSealed` is set only as the
 * reservation sets it, so an upload from before sealing has no such field.
 */
function grantIn(
  t: TestTransaction,
  userId: UploadOwner,
  fileId: string,
  nameSealed: boolean
) {
  return t.run((ctx) =>
    ctx.db.insert("ninaUploads", {
      userId,
      expiresAt: EXPIRES_AT,
      ...(nameSealed ? { nameSealed: true } : {}),
      state: { status: "ready", fileId },
    })
  );
}

/**
 * Sends the uploads as one message, and reports the file name that the model reads
 * for each, or the code of the refusal.
 */
function sendIn(
  t: TestTransaction,
  userId: UploadOwner,
  uploadIds: readonly UploadId[],
  text: string
) {
  return t.run((ctx) =>
    Effect.runPromise(
      consumeAttachments(userId, uploadIds, text).pipe(
        Effect.map((sent) =>
          Arr.map(sent.parts, (part) =>
            "filename" in part ? part.filename : undefined
          )
        ),
        Effect.match({
          onFailure: (error) => error.code,
          onSuccess: (names) => names,
        }),
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

describe("Nina attachment names", () => {
  it("retries a stored message whose file has a name from before sealing, even one that begins with the prefix", async () => {
    const t = createConvexTestWithBetterAuth();
    const fileId = await storeNamedFile(t, "nakafa.sealed.v1:abcd");

    expect(await checkStored(t, [fileId])).toBe("accepted");
  });

  it("sends a pending upload from before sealing with its name as it is, even one that begins with the prefix", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const fileId = await storeNamedFile(t, "nakafa.sealed.v1:abcd");
    const uploadId = await grantIn(t, owner, fileId, false);

    expect(await sendIn(t, owner, [uploadId], "Read this.")).toEqual([
      "nakafa.sealed.v1:abcd",
    ]);
  });

  it("sends the sealed names of a message with one read of the learner's keys", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    let uploadIds: readonly UploadId[] = [];
    for (const name of ["Soal-1.pdf", "Soal-2.pdf", "Soal-3.pdf"]) {
      const sealedName = await sealedFileNameIn(t, owner, name);
      const fileId = await storeNamedFile(t, sealedName);
      uploadIds = Arr.append(uploadIds, await grantIn(t, owner, fileId, true));
    }
    vi.mocked(readLearnerKeys).mockClear();

    expect(await sendIn(t, owner, uploadIds, "Read these.")).toEqual([
      "Soal-1.pdf",
      "Soal-2.pdf",
      "Soal-3.pdf",
    ]);
    expect(readLearnerKeys).toHaveBeenCalledTimes(1);
  });
});
