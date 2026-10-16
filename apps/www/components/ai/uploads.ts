import type { Ref } from "@confect/core";
import type { InvokeReturn, useAction } from "@confect/react";
import {
  NINA_DOCUMENT_SIZE_MESSAGE,
  NinaFileType,
  NinaUploadError,
} from "@repo/backend/client/nina/uploads";
import type nina from "@repo/backend/confect/_generated/refs/nina";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { FileUIPart } from "ai";
import {
  Array as Arr,
  Clock,
  Effect,
  MutableHashMap,
  Option,
  Schema,
} from "effect";
import { exceedsDocumentLimit } from "@/components/ai/attachments";
import {
  NinaConnectionError,
  requireNinaConnection,
} from "@/components/ai/feedback";
import type { AiStore } from "@/components/ai/store/types";
import type { NinaDraft } from "@/components/ai/submission";

/** The call that gives back one upload, as the page makes it. */
type ReleaseCall = (
  args: Ref.Args<typeof nina.uploads.release>
) => InvokeReturn<typeof nina.uploads.release>;

/** The Convex connection a send waits on, as requireNinaConnection reads it. */
type NinaConnection = Parameters<typeof requireNinaConnection>[0];

/**
 * Gives back the places the server holds for uploads the learner will not
 * send, and returns the uploads that are no longer held: each one the server
 * gave back, and each one it refuses as gone or not the learner's, since
 * nothing is held for that one. A release that fails for any other reason is
 * logged as a warning, its upload is not returned, and the server's expiry
 * frees its place. One failure never blocks the learner or stops the others.
 *
 * The caller forgets a hold only once the server gave its place back, so the
 * hold of a failed release stays in the store and a later send gives it back.
 *
 * A composer that is left with files in it gives nothing back at once. A
 * hidden sheet keeps its files and sends the same uploads again, and the page
 * cannot tell a hidden composer from a destroyed one. The next send that needs
 * the room gives back what is held for files outside it, and the server's
 * expiry covers the rest.
 */
export const releaseUploads = Effect.fn("nina.uploads.release")(function* (
  uploadIds: readonly Id<"ninaUploads">[],
  release: ReleaseCall
) {
  const given = yield* Effect.forEach(
    uploadIds,
    (uploadId) =>
      Effect.tryPromise(() => release({ uploadId })).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.catchTag("NinaUploadError", (refusal) =>
          refusal.code === "NINA_UPLOAD_INVALID"
            ? Effect.void
            : Effect.fail(refusal)
        ),
        Effect.as(uploadId),
        Effect.tapError((failure) =>
          Effect.logWarning(
            "An upload was not given back, so its place returns when it expires.",
            failure
          )
        ),
        Effect.option,
        Effect.annotateLogs({ uploadId })
      ),
    { concurrency: "unbounded" }
  );
  return Arr.getSomes(given);
});

/**
 * Gives back the places of refused uploads, so the send that calls it counts the
 * room it needs without them. The server counts a refused upload until a release
 * gives its place back, and no send takes it again, so each upload given back is
 * forgotten. When one could not be given back, the send fails, and that upload
 * stays refused for the next send.
 */
export const giveBackRefusedUploads = Effect.fn("nina.uploads.refused")(
  function* (
    uploadIds: readonly Id<"ninaUploads">[],
    release: ReleaseCall,
    forget: (uploadIds: readonly Id<"ninaUploads">[]) => void
  ) {
    const given = yield* releaseUploads(uploadIds, release);
    forget(given);
    if (given.length < uploadIds.length) {
      return yield* new NinaUploadError({
        code: "NINA_UPLOAD_FAILED",
        message: "An earlier attachment could not be released. Try again.",
      });
    }
  }
);

/**
 * What the uploads of a send need from the store: to show a chip as uploading
 * or failed, to know which upload already holds a file, to give back the places
 * held for files outside the send when the send needs the room, and to give back
 * the places of the uploads the server refused.
 */
export type UploadStore = Pick<
  AiStore,
  | "clearUpload"
  | "forgetUploads"
  | "keepUpload"
  | "markUpload"
  | "readRefusedUploads"
  | "readUploads"
  | "strayFiles"
  | "uploadOf"
>;

/**
 * The upload that holds a file: the one an earlier send kept while the server
 * still keeps it, or a new upload that this send makes and keeps.
 */
const holdAttachment = Effect.fn("nina.upload.hold")(function* (
  attachment: NonNullable<NinaDraft["files"]>[number],
  mediaType: typeof NinaFileType.Type,
  upload: ReturnType<typeof useAction<typeof nina.uploads.save>>,
  convex: NinaConnection,
  status: UploadStore
) {
  // The moment the upload begins, which the store counts its life from.
  const startedAt = yield* Clock.currentTimeMillis;
  // A file that holds an upload from an earlier send is not uploaded again,
  // unless the server has dropped that upload by now. An upload the server
  // refused is no longer a hold, so it is never handed out again. A failed send
  // leaves its uploads where they are: the server refuses with a failure it
  // throws, which rolls the whole mutation back, and Convex's client sends a
  // mutation again when it lost the answer instead of failing it.
  const cached = status.uploadOf(attachment.id, startedAt);
  if (Option.isSome(cached)) {
    return cached.value;
  }
  // A file the browser cannot read shows as failed, so the learner sees which
  // one blocks the send.
  const bytes = yield* Effect.tryPromise({
    try: () => attachment.file.arrayBuffer(),
    catch: () =>
      new NinaUploadError({
        code: "NINA_UPLOAD_FAILED",
        message: "Unable to read this attachment.",
      }),
  }).pipe(
    Effect.tapError(() =>
      Effect.sync(() => status.markUpload(attachment.id, "error"))
    )
  );
  yield* requireNinaConnection(convex);
  // The file shows as uploading from the moment its bytes go, and as failed if
  // the upload does not finish. A refusal while offline is no fault of the file.
  // Both are kept under the id of the file: its preview address changes when a
  // hidden composer shows again, so a failure written under the address of
  // this send would never be found by the chip.
  yield* Effect.sync(() => status.markUpload(attachment.id, "uploading"));
  const id = yield* Effect.tryPromise({
    try: () => upload({ bytes, mediaType, filename: attachment.file.name }),
    catch: () =>
      new NinaConnectionError({
        code: "NINA_CONNECTION_FAILED",
        message: "Nina upload could not be confirmed.",
      }),
  }).pipe(
    Effect.flatMap(Effect.fromResult),
    Effect.tapError(() =>
      Effect.sync(() => status.markUpload(attachment.id, "error"))
    )
  );
  yield* Effect.sync(() => status.keepUpload(attachment.id, id, startedAt));
  yield* Effect.sync(() => status.clearUpload(attachment.id));
  return id;
});

/** Uploads one file unless it already holds an upload, and shows how far the upload is. */
const uploadAttachment = Effect.fn("nina.upload")(function* (
  attachment: NonNullable<NinaDraft["files"]>[number],
  upload: ReturnType<typeof useAction<typeof nina.uploads.save>>,
  previews: MutableHashMap.MutableHashMap<Id<"ninaUploads">, FileUIPart>,
  convex: NinaConnection,
  status: UploadStore
) {
  const mediaType = yield* Schema.decodeUnknownEffect(NinaFileType)(
    attachment.file.type
  ).pipe(
    Effect.mapError(
      () =>
        new NinaUploadError({
          code: "NINA_UPLOAD_INVALID",
          message: "This attachment type is not supported.",
        })
    )
  );
  const id = yield* holdAttachment(
    attachment,
    mediaType,
    upload,
    convex,
    status
  );
  // Written on both paths from the file this send holds. A hidden composer gives
  // each file a new preview address when it shows again, so the address an
  // upload kept from an earlier send is not the one the message should show.
  MutableHashMap.set(previews, id, {
    type: "file",
    url: attachment.url,
    mediaType,
    filename: attachment.file.name,
  });
  return id;
});

/**
 * Uploads one message's attachments, refusing oversized documents before any
 * upload starts. The server also counts the uploads held for files of
 * composers that are gone and the uploads it refused, and refuses an upload
 * beyond its limit, so a send that would not fit beside them gives those places
 * back first.
 */
export const uploadAttachments = Effect.fn("nina.uploads")(function* (
  files: NonNullable<NinaDraft["files"]>,
  upload: ReturnType<typeof useAction<typeof nina.uploads.save>>,
  release: ReleaseCall,
  previews: MutableHashMap.MutableHashMap<Id<"ninaUploads">, FileUIPart>,
  convex: NinaConnection,
  status: UploadStore
) {
  if (exceedsDocumentLimit(Arr.map(files, (attachment) => attachment.file))) {
    return yield* new NinaUploadError({
      code: "NINA_UPLOAD_SIZE",
      message: NINA_DOCUMENT_SIZE_MESSAGE,
    });
  }
  // A refused upload still counts on the server, so its place goes back before
  // this send counts the room it needs.
  const refused = status.readRefusedUploads();
  if (Arr.isReadonlyArrayNonEmpty(refused)) {
    // A call made offline waits for the connection, and the send with it.
    yield* requireNinaConnection(convex);
    yield* giveBackRefusedUploads(refused, release, status.forgetUploads);
  }
  const now = yield* Clock.currentTimeMillis;
  const strays = status.strayFiles(
    Arr.map(files, (attachment) => attachment.id),
    now
  );
  if (Arr.isReadonlyArrayNonEmpty(strays)) {
    // A call made offline waits for the connection, and the send with it.
    yield* requireNinaConnection(convex);
    const given = yield* releaseUploads(status.readUploads(strays), release);
    status.forgetUploads(given);
  }
  return yield* Effect.forEach(files, (attachment) =>
    uploadAttachment(attachment, upload, previews, convex, status)
  );
});
