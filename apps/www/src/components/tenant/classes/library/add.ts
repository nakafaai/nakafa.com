import type { Ref } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import type classroom from "@repo/backend/confect/_generated/refs/classroom";
import type connectors from "@repo/backend/confect/_generated/refs/connectors";
import { randomUuid } from "@repo/utilities/uuid";
import { Clock, Data, Effect, type Result, Schema } from "effect";
import {
  addLinkUpdate,
  type LibraryItem,
} from "@/components/tenant/classes/library/optimistic";
import type {
  LibraryUpload,
  LibraryUploads,
} from "@/components/tenant/classes/library/uploads";
import { schoolCall } from "@/components/tenant/write";

/** The arguments of one link, as the dialog gives them. */
type LinkArgs = Ref.Args<typeof classroom.library.addLink>;

/**
 * The link the teacher adds, shown at once first in the library under its client key, which is
 * its placeholder ID until the server answers. `add` is Confect's mutation with the optimistic
 * update it is given.
 */
export const addLibraryLink = Effect.fn("classroom.library.addLink")(function* <
  E,
>(
  add: (
    update: ReturnType<typeof addLinkUpdate>,
    args: LinkArgs
  ) => Promise<Result.Result<LibraryItem, E>>,
  author: string,
  args: LinkArgs
) {
  const createdAt = yield* Clock.currentTimeMillis;
  const id = yield* Schema.decodeUnknownEffect(Id("classroomLibrary"))(
    args.clientKey
  );
  return yield* schoolCall(() =>
    add(
      addLinkUpdate({
        address: args.address,
        author,
        byteSize: null,
        clientKey: args.clientKey,
        createdAt,
        folderId: args.folderId,
        id,
        kind: "link",
        starred: false,
        title: args.title,
        trashedAt: null,
      }),
      args
    )
  );
});

/** What a reservation answers: the presigned address of the upload and the reservation it registers. */
type Reserved = Ref.Returns<typeof classroom.library.reserve>;

/**
 * Adds one file to the library: it reserves the file's bytes, which the server charges to the school before any
 * byte moves, sends the file straight to R2 at the address it answers, reporting progress, and registers the
 * upload, which the server checks before it keeps it. A send that R2 or the browser refuses still frees the reserved
 * bytes at once and fails with its error. The module that sends the file loads only now, so the page's first
 * JavaScript does not carry it.
 */
export const uploadLibraryFile = Effect.fn("classroom.library.upload")(
  function* <ReserveError, RegisterError, Registered>(
    file: File,
    reserve: () => Promise<Result.Result<Reserved, ReserveError>>,
    register: (
      uploadId: Reserved["uploadId"]
    ) => Promise<Result.Result<Registered, RegisterError>>,
    onProgress: (fraction: number) => void
  ) {
    const reserved = yield* schoolCall(reserve);
    const { putLibraryFile } = yield* Effect.tryPromise(
      () => import("@/components/tenant/classes/library/send")
    );
    // A send that fails registers the reservation anyway: the server finds no bytes, frees them, and refuses it.
    yield* putLibraryFile(reserved.address, file, onProgress).pipe(
      Effect.tapError(() =>
        Effect.ignore(schoolCall(() => register(reserved.uploadId)))
      )
    );
    return yield* schoolCall(() => register(reserved.uploadId));
  }
);

/**
 * Sends one file of the library under a new client key. Its row shows at once,
 * stays once the server kept the file until the library's own row arrives, and
 * leaves when the server refused it. `send` adds the file under the key.
 */
export const sendLibraryFile = Effect.fn("classroom.library.send")(function* <
  A,
  E,
>(
  uploads: Pick<LibraryUploads, "end" | "settle" | "start">,
  shown: Pick<LibraryUpload, "author" | "kind" | "title">,
  send: (clientKey: string) => Effect.Effect<A, E>
) {
  const clientKey = yield* randomUuid;
  const createdAt = yield* Clock.currentTimeMillis;
  uploads.start({ ...shown, clientKey, createdAt, progress: 0, sent: false });
  return yield* send(clientKey).pipe(
    Effect.tap(() => Effect.sync(() => uploads.settle(clientKey))),
    Effect.tapError(() => Effect.sync(() => uploads.end(clientKey)))
  );
});

/** The teacher's account has no Drive connection to pick from. */
export class DriveMissing extends Data.TaggedError("DriveMissing") {}

/**
 * Lets the teacher pick one file of their own Google Drive. The server gives
 * the Picker its token first, so an account without Drive is told before
 * anything opens, and Google's Picker, whose module loads only now, runs `hide`
 * once it can show. It answers the picked file, or none when the teacher closed
 * the Picker.
 */
export const pickFromDrive = Effect.fn("classroom.library.pickDrive")(
  function* <E>(
    requestKeys: () => Promise<
      Result.Result<Ref.Returns<typeof connectors.drive.pickerToken>, E>
    >,
    locale: string,
    hide: () => void,
    accept?: string
  ) {
    const keys = yield* schoolCall(requestKeys);
    if (keys === null) {
      return yield* new DriveMissing();
    }
    const { pickDriveFile } = yield* Effect.tryPromise(
      () => import("@/components/tenant/classes/library/drive")
    );
    return yield* pickDriveFile(keys, locale, hide, accept);
  }
);
